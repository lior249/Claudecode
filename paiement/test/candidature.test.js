'use strict';

const test = require('node:test');
const assert = require('node:assert');
const crypto = require('crypto');
const fs = require('fs');
const { monter, configTest, fauxOAuth, cookieSession, ADMIN, ROLES } = require('./aide');
const { creerBob } = require('../src/bob');
const urls = (composants) => (composants || []).flatMap((r) => r.components.map((b) => b.data.url));

function tally(m, champs) {
  const corps = JSON.stringify({ data: { fields: champs } });
  const sig = crypto.createHmac('sha256', 'tallysecret').update(corps).digest('base64');
  return fetch(`${m.base}/webhooks/tally`, { method: 'POST', headers: { 'tally-signature': sig }, body: corps });
}

function fauxBobDiscord(m) {
  const dms = [];
  const kicks = [];
  const roles = new Set([ROLES.attente]);
  const client = { isReady: () => true, users: { fetch: async (id) => ({ send: async (c) => dms.push([id, typeof c === 'string' ? c : c.content, c.components]) }) } };
  const serveur = { id: 'guild', members: { fetch: async () => ({ roles: { cache: { has: (r) => roles.has(r), set: roles }, remove: async (r) => roles.delete(r) }, kick: async () => kicks.push('C1') }) } };
  const bob = creerBob({ config: m.config, db: m.db, commandes: m.commandes, coaching: m.coaching, candidatures: m.candidatures, client, serveur });
  return { bob, dms, kicks };
}

test('candidature Elite : connexion Discord → formulaire 1 (nom) → examen → retenu → formulaire 2 (vidéo) → validé → paiement', async () => {
  const CID = '500000000000000001';
  const holder = {};
  const m = await monter({ avecCandidatures: true, bob: {
    idDepuisPseudo: async (p) => (p.toLowerCase() === 'koffi_99' ? CID : null),
    candidatureRecue: (...a) => holder.bob.candidatureRecue(...a), videoRecue: (...a) => holder.bob.videoRecue(...a),
    appliquerDecision: (...a) => holder.bob.appliquerDecision(...a),
  } });
  try {
    const d = fauxBobDiscord(m);
    holder.bob = d.bob;
    const envoyer = (corps, cookie) => fetch(`${m.base}/api/candidature/formulaire`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...(cookie ? { cookie } : {}) }, body: JSON.stringify(corps),
    });

    // Sans connexion : la page demande d'abord le compte Discord, et l'envoi est refusé.
    assert.match(await (await m.get('/coaching/elite', { cookie: '' })).text(), /Connecte ton compte Discord/);
    assert.strictEqual((await envoyer({ reponses: { nom: 'Koffi Mensah' } })).status, 401);
    // Connecté (bouton de Bob) : le pseudo n'est plus demandé.
    const cookieC = cookieSession(CID, 'koffi_99');
    const page = await (await m.get('/coaching/elite', { cookie: cookieC })).text();
    assert.match(page, /Quel est ton nom \?/);
    assert.doesNotMatch(page, /Quel est ton pseudo Discord \?/);
    assert.match(page, /Ton formulaire est en cours de traitement/);
    let r = await envoyer({ reponses: { nom: '' } }, cookieC);
    assert.deepStrictEqual(await r.json(), { champ: 'nom', erreur: 'Cette question est obligatoire.' });
    r = await envoyer({ reponses: { nom: 'Koffi Mensah' } }, cookieC);
    assert.strictEqual(r.status, 200);
    assert.strictEqual(m.candidatures.parDiscord(CID).statut, 'examen');
    assert.ok(d.dms.some(([id, t]) => id === CID && /bien reçu/.test(t)));
    const alerte = d.dms.find(([id, t]) => id === ADMIN && /Nouvelle candidature/.test(t));
    assert.match(alerte[1], /Koffi Mensah/);
    assert.strictEqual((await envoyer({ reponses: { nom: 'X' } }, cookieC)).status, 409, 'une seule candidature');

    // L'admin retient : Bob envoie le lien personnel de la suite.
    await d.bob.surInteraction({ user: { id: ADMIN }, isButton: () => true, customId: 'cand:retenir:1', message: { content: 'x' }, update: async () => {}, reply: async () => {} });
    const lien = urls(d.dms.find(([id, t]) => id === CID && /retenu/.test(t))[2])[0];
    const connexion = await m.get(lien.replace('http://localhost', ''));
    const cookie = connexion.headers.get('set-cookie').split(';')[0];
    const f2 = await (await m.get('/coaching/elite/candidature', { cookie })).text();
    assert.match(f2, /Ton profil est retenu/);
    assert.match(f2, /Envoie une vidéo de toi/);

    // Formulaire 2 : réponses puis vidéo (20 Mo max).
    const conf = await fetch(`${m.base}/api/candidature/confirmation`, { method: 'POST', headers: { 'Content-Type': 'application/json', cookie }, body: JSON.stringify({ reponses: {} }) });
    assert.strictEqual(conf.status, 200);
    assert.strictEqual((await fetch(`${m.base}/api/candidature/video`, { method: 'POST', headers: { cookie, 'Content-Type': 'image/png' }, body: Buffer.alloc(10) })).status, 400);
    assert.strictEqual((await fetch(`${m.base}/api/candidature/video`, { method: 'POST', headers: { cookie, 'Content-Type': 'video/mp4' }, body: Buffer.alloc(2048, 7) })).status, 200);
    const c = m.candidatures.parId(1);
    assert.strictEqual(c.statut, 'video');
    const chemin = m.candidatures.cheminVideo(c);
    assert.ok(fs.existsSync(chemin));
    assert.ok(d.dms.some(([id, t]) => id === ADMIN && /Vidéo de candidature reçue/.test(t)));

    // Admin : réponses, vidéo, validation.
    const admin = cookieSession(ADMIN, 'admin');
    assert.strictEqual((await m.get('/admin/videos/1', { cookie })).status, 403);
    const liste = await (await m.get('/admin/candidatures', { cookie: admin })).text();
    assert.match(liste, /Vidéo à regarder/);
    assert.match(liste, /Koffi Mensah/);
    assert.strictEqual((await m.get('/admin/videos/1', { cookie: admin, range: 'bytes=0-99' })).status, 206);
    assert.strictEqual((await m.poster('/admin/candidatures/1/valider', {}, { cookie: admin })).status, 303);
    assert.ok(!fs.existsSync(chemin), 'vidéo supprimée après la décision');
    const lienPaiement = m.candidatures.lienPaiement(m.candidatures.parId(1));
    const cheminPaiement = new URL(lienPaiement).pathname;
    assert.ok(d.dms.some(([id, , c]) => id === CID && urls(c).some((u) => u.endsWith(`retour=${encodeURIComponent(cheminPaiement)}`))),
      'bouton personnel : connecte puis ouvre le paiement');
    const suivi = await (await m.get('/coaching/elite/candidature', { cookie })).text();
    assert.match(suivi, /Payer par mobile money/);
    assert.ok(suivi.includes('href="https://whop.com/overmaxx/legroupe-secret-accompagnement-prive/"'), 'carte : offre Whop cachée par défaut');
    assert.match(await (await m.get(cheminPaiement, { cookie })).text(), /327/);
    assert.strictEqual((await m.get(cheminPaiement, { cookie: cookieSession('AUTRE', 'autre') })).status, 403, 'lien réservé au compte du candidat');
    // Revenir sur /coaching/elite renvoie vers le suivi.
    assert.strictEqual((await m.get('/coaching/elite', { cookie })).headers.get('location'), '/coaching/elite/candidature');
  } finally { await m.fermer(); }
});

test('candidature refusée : message, rôle Attente retiré du serveur ; décisions impossibles hors étape', async () => {
  const m = await monter({ avecCandidatures: true });
  try {
    const d = fauxBobDiscord(m);
    const c = m.candidatures.demarrer('C1', 'yao');
    assert.match(m.candidatures.decider(c.id, 'retenir').erreur, /Déjà traitée|statut/);
    m.candidatures.recevoirFormulaire('C1', [{ label: 'Q', valeur: 'R' }]);
    assert.match(m.candidatures.decider(c.id, 'valider').erreur, /statut/);
    const r = await d.bob.appliquerDecision(c.id, 'refuser');
    assert.ok(r.ok);
    assert.ok(d.dms.some(([id, t]) => id === 'C1' && /pas été retenu/.test(t)));
    assert.deepStrictEqual(d.kicks, ['C1'], 'il n\'avait que le rôle Attente : retiré du serveur');
    assert.match(m.candidatures.decider(c.id, 'refuser').erreur, /Déjà traitée|statut/);
  } finally { await m.fermer(); }
});

test('connexion par Bob : /connexion, lien à usage unique, bouton Postuler (rôle Attente), /lier CODE après paiement', async () => {
  const m = await monter({ avecCandidatures: true });
  try {
    const d = fauxBobDiscord(m);
    const reponses = [];
    const inter = (extra) => ({
      user: { id: 'C1', username: 'yao' }, isButton: () => false, isChatInputCommand: () => true,
      reply: async (o) => reponses.push(o), ...extra,
    });
    // /connexion : liens personnels (non-Elite : candidature)
    await d.bob.surInteraction(inter({ commandName: 'connexion' }));
    const lien = urls(reponses[0].components)[0];
    assert.match(lien, /\/connexion\/bob\?t=.*retour=%2Fcoaching%2Felite%2Fcandidature/);
    assert.strictEqual(reponses[0].flags, 64, 'visible par lui seul');

    const chemin = lien.replace('http://localhost', '');
    const r1 = await m.get(chemin);
    assert.strictEqual(r1.status, 302);
    assert.strictEqual(r1.headers.get('location'), '/coaching/elite/candidature');
    const cookie = r1.headers.get('set-cookie').split(';')[0];
    assert.deepStrictEqual(await (await m.get('/api/candidature', { cookie })).json(), { statut: 'formulaire' });
    assert.strictEqual((await m.get(chemin)).status, 302, 'lien personnel réutilisable (30 jours)');
    assert.strictEqual((await m.get('/connexion/bob?t=faux.faux&retour=/admin')).status, 400);

    // Bouton Postuler
    reponses.length = 0;
    await d.bob.surInteraction(inter({ isButton: () => true, isChatInputCommand: () => false, customId: 'ovx:postuler' }));
    assert.match(reponses[0].content, /candidature \*\*Elite\*\*/);

    // /lier CODE après un paiement Community
    await m.poster('/community/paiement', { nom: 'Yao', email: 'yao@example.com' });
    m.saspay.payer(m.saspay.derniere().id);
    const e = await m.etat(m.saspay.derniere().metadata.ref);
    m.db.prepare("UPDATE membres SET discord_id = NULL WHERE email = 'yao@example.com'").run(); // paiement d'avant la connexion obligatoire
    const code = (await (await m.get(e.redirection)).text()).match(/\/lier ([A-Z2-9]{6})/)[1];
    reponses.length = 0;
    await d.bob.surInteraction(inter({ commandName: 'lier', options: { getString: () => 'zzzzzz' } }));
    assert.match(reponses[0].content, /Code inconnu/);
    await d.bob.surInteraction(inter({ commandName: 'lier', options: { getString: () => code.toLowerCase() } }));
    assert.match(reponses[1].content, /relié à \*\*Overmaxx Community\*\*/);
    assert.strictEqual(m.db.prepare("SELECT discord_id FROM membres WHERE email = 'yao@example.com'").get().discord_id, 'C1');
  } finally { await m.fermer(); }
});

test('formulaire rempli sans connexion : Bob retrouve le candidat grâce à son pseudo Discord', async () => {
  const appels = [];
  const holder = {};
  const m = await monter({ avecCandidatures: true, bob: {
    idDepuisPseudo: async (p) => { appels.push(p); return p.trim().replace(/^@/, '').toLowerCase() === 'awa_27' ? '700000000000000001' : null; },
    candidatureRecue: async (c) => holder.recue.push(c),
    candidature: async (champs, note) => holder.inconnu.push(note),
  } });
  holder.recue = []; holder.inconnu = [];
  try {
    assert.strictEqual((await tally(m, [{ label: 'Ton pseudo Discord', value: ' @Awa_27 ' }, { label: 'Objectif', value: '10k' }])).status, 200);
    assert.strictEqual(holder.recue.length, 1);
    const c = m.candidatures.parDiscord('700000000000000001');
    assert.strictEqual(c.statut, 'examen');
    assert.strictEqual(c.pseudo, 'Awa_27');
    // Pseudo introuvable : l'admin est prévenu pour répondre lui-même.
    await tally(m, [{ label: 'Ton pseudo Discord', value: 'inconnu' }]);
    assert.match(holder.inconnu[0], /introuvable/);
  } finally { await m.fermer(); }
});

test('page de connexion : pseudo Discord, tutoriel en 3 images (servies avec cache), bouton Rejoindre le Discord', async () => {
  const m = await monter({ avecCandidatures: true });
  try {
    const page = await (await m.get('/coaching/elite', { cookie: '' })).text();
    assert.match(page, /Connecte ton compte Discord/);
    assert.match(page, /name="retour" value="\/coaching\/elite"/);
    assert.match(page, /Où trouver mon pseudo \?/);
    assert.match(page, /Rejoindre le Discord/);
    assert.ok(page.includes('href="https://discord.gg/test"'));
    assert.match(page, /\/static\/aide\/pseudo-3\.jpg/);
    for (const n of [1, 2, 3]) {
      const r = await m.get(`/static/aide/pseudo-${n}.jpg`);
      assert.strictEqual(r.status, 200);
      assert.match(r.headers.get('content-type'), /image\/jpeg/);
      assert.match(r.headers.get('cache-control'), /max-age=604800/);
    }
  } finally { await m.fermer(); }
});

test('message de Bob à l\'admin : lien vers la fiche du candidat, décision prise sur la plateforme', async () => {
  const m = await monter({ avecCandidatures: true });
  try {
    const d = fauxBobDiscord(m);
    m.candidatures.demarrer('C1', 'yao_k');
    const champs = [{ label: 'Quel est ton nom ?', valeur: 'Yao Kossi' }, { label: 'Quel est ton pseudo Discord ?', valeur: 'yao_k' }];
    const c = m.candidatures.recevoirFormulaire('C1', champs);
    await d.bob.candidatureRecue(c, champs);
    const [, texte, composants] = d.dms.find(([id]) => id === ADMIN);
    assert.match(texte, /\*\*Yao Kossi\*\*/);
    assert.match(texte, /depuis la plateforme/);
    const boutons = composants[0].components.map((b) => b.data);
    assert.strictEqual(boutons.length, 1, 'un seul bouton : le lien vers la fiche');
    assert.strictEqual(boutons[0].url, `http://localhost/admin/candidatures/${c.id}`);

    const admin = cookieSession(ADMIN, 'admin');
    const fiche = await (await m.get(`/admin/candidatures/${c.id}`, { cookie: admin })).text();
    assert.match(fiche, /Yao Kossi/);
    assert.match(fiche, /name="retour" value="fiche"/);
    assert.strictEqual((await m.get(`/admin/candidatures/${c.id}`, { cookie: cookieSession('C1') })).status, 403);
    assert.strictEqual((await m.get('/admin/candidatures/999', { cookie: admin })).status, 404);

    const r = await m.poster(`/admin/candidatures/${c.id}/retenir`, { retour: 'fiche' }, { cookie: admin });
    assert.strictEqual(r.headers.get('location'), `/admin/candidatures/${c.id}?fait=retenir`);
    assert.strictEqual(m.candidatures.parId(c.id).statut, 'retenu');
    assert.match(await (await m.get(r.headers.get('location'), { cookie: admin })).text(), /Bob lui a envoyé le lien de la suite/);
  } finally { await m.fermer(); }
});

test('suivi sans connexion : après le formulaire, la page suit la candidature et permet de continuer (cookie limité)', async () => {
  const m = await monter({ avecCandidatures: true, bob: { idDepuisPseudo: async () => '900000000000000001', candidatureRecue: async () => {}, videoRecue: async () => {} } });
  try {
    const r = await fetch(`${m.base}/api/candidature/formulaire`, { method: 'POST', headers: { 'Content-Type': 'application/json', cookie: cookieSession('900000000000000001', 'ama_d') },
      body: JSON.stringify({ reponses: { nom: 'Ama' } }) });
    assert.strictEqual(r.status, 200);
    const cookie = r.headers.get('set-cookie').split(';')[0];
    assert.match(cookie, /^ovx_cand=/);
    assert.deepStrictEqual(await (await m.get('/api/candidature', { cookie })).json(), { statut: 'examen' });
    assert.match(await (await m.get('/coaching/elite/candidature', { cookie })).text(), /se met à jour toute seule/);
    assert.strictEqual((await m.get('/coaching/elite', { cookie })).headers.get('location'), '/coaching/elite/candidature');

    m.candidatures.decider(1, 'retenir');
    assert.deepStrictEqual(await (await m.get('/api/candidature', { cookie })).json(), { statut: 'retenu' });
    assert.match(await (await m.get('/coaching/elite/candidature', { cookie })).text(), /Ton profil est retenu/);
    const conf = await fetch(`${m.base}/api/candidature/confirmation`, { method: 'POST', headers: { 'Content-Type': 'application/json', cookie }, body: '{"reponses":{}}' });
    assert.strictEqual(conf.status, 200);
    const vid = await fetch(`${m.base}/api/candidature/video`, { method: 'POST', headers: { cookie, 'Content-Type': 'video/mp4' }, body: Buffer.alloc(500, 1) });
    assert.strictEqual(vid.status, 200);
    assert.strictEqual(m.candidatures.parId(1).statut, 'video');
    // Le cookie de suivi n'ouvre ni le coaching ni l'admin.
    assert.doesNotMatch(await (await m.get('/coaching', { cookie })).text(), /Mes créneaux de coaching/);
    assert.doesNotMatch(await (await m.get('/admin', { cookie })).text(), /Calendrier des coachings/);
    // Un cookie falsifié ne donne rien.
    assert.deepStrictEqual(await (await m.get('/api/candidature', { cookie: 'ovx_cand=faux.faux' })).json(), { statut: null });
  } finally { await m.fermer(); }
});

test('messages privés impossibles : fil privé avec les mêmes boutons, réutilisé ; l\'admin prévenu seulement si rien ne passe', async () => {
  const m = await monter({ avecCandidatures: true });
  try {
    const recus = [];
    const client = { isReady: () => true, users: { fetch: async (id) => ({ send: async (c) => {
      if (id !== ADMIN) throw new Error('Cannot send messages to this user');
      recus.push([id, c.content]);
    } }) } };
    // Discord simulé : #en-attente (visible par En Attente) et #general (visible par les membres d'un programme).
    const fils = [];
    const filsParId = new Map();
    const salon = (id, rawPosition, visiblePar) => ({
      id, name: id, rawPosition, type: 0,
      permissionsFor: (qui) => ({ has: () => qui.id === 'BOB' || visiblePar(qui) }),
      threads: { create: async (o) => {
        const fil = { id: `fil-${fils.length + 1}`, salon: id, options: o, archived: false, membres: [], messages: [],
          members: { add: async (u) => fil.membres.push(u) }, send: async (msg) => fil.messages.push(msg) };
        fils.push(fil); filsParId.set(fil.id, fil); return fil;
      } },
    });
    const membre = (id, roles) => ({ id, user: { username: id }, roles: { cache: { has: (r) => roles.includes(r) } } });
    const membres = new Map([['F1', membre('F1', [ROLES.attente])], ['F2', membre('F2', [ROLES.community])]]);
    const salons = new Map([
      ['attente', salon('attente', 0, (qui) => qui.roles?.cache.has(ROLES.attente))],
      ['annonces', { id: 'annonces', type: 5, permissionsFor: () => ({ has: () => true }), threads: {} }],
      ['general', salon('general', 3, (qui) => qui.roles?.cache.has(ROLES.community))],
    ]);
    const serveur = { id: 'guild',
      members: { me: { id: 'BOB' }, fetch: async (id) => membres.get(id) || null },
      channels: { fetch: async (id) => (id ? salons.get(id) || filsParId.get(id) || null : salons) } };
    m.db.prepare('INSERT INTO envois (cle, envoye_le) VALUES (?, ?)').run('config:salon-attente', 'attente');
    const bob = creerBob({ config: m.config, db: m.db, commandes: m.commandes, coaching: m.coaching, candidatures: m.candidatures, client, serveur });

    const boutons = { content: 'Bonjour', components: [{ components: [{ data: { url: 'https://overmaxx.online/community' } }] }] };
    assert.strictEqual(await bob.notifier.membre('F1', boutons), true);
    assert.strictEqual(fils.length, 1);
    assert.strictEqual(fils[0].salon, 'attente', 'nouveau venu : fil dans le salon d\'attente');
    assert.strictEqual(fils[0].options.type, 12, 'fil privé');
    assert.deepStrictEqual(fils[0].membres, ['F1']);
    assert.match(fils[0].messages[0].content, /^<@F1> Bonjour/);
    assert.deepStrictEqual(urls(fils[0].messages[0].components), ['https://overmaxx.online/community'], 'mêmes boutons');

    // Deuxième message : même fil, rouvert s'il était archivé.
    fils[0].archived = true; fils[0].setArchived = async (v) => { fils[0].archived = v; };
    await bob.notifier.membre('F1', 'Encore');
    assert.strictEqual(fils.length, 1);
    assert.strictEqual(fils[0].archived, false);
    assert.strictEqual(fils[0].messages.length, 2);

    // Membre Community (ne voit pas #en-attente) : fil dans le premier salon qu'il voit (pas un salon d'annonces).
    await bob.notifier.membre('F2', 'Renouvelle');
    assert.strictEqual(fils[1].salon, 'general');
    assert.ok(!recus.length, 'l\'admin ne reçoit rien quand le fil a marché');

    // Pas sur le serveur : ni MP ni fil → l'admin est prévenu (une fois par jour).
    assert.strictEqual(await bob.notifier.membre('F3', 'Coucou'), false);
    await bob.notifier.membre('F3', 'Coucou');
    assert.strictEqual(recus.filter(([id, t]) => id === ADMIN && /pas \(ou plus\) sur le serveur/.test(t)).length, 1);

    // Sans les droits de fil : l'admin reçoit la raison.
    serveur.members.me = { id: 'AUTRE' };
    membres.set('F4', membre('F4', [ROLES.attente]));
    assert.strictEqual(await bob.notifier.membre('F4', 'Coucou'), false);
    assert.ok(recus.some(([id, t]) => id === ADMIN && /Créer des fils privés/.test(t)));
  } finally { await m.fermer(); }
});

test('relances des candidats retenus sans suite : 24 h puis 72 h, sans doublon', async () => {
  const m = await monter({ avecCandidatures: true });
  try {
    const dms = [];
    let now = new Date('2026-12-01T10:00:00Z');
    const { creerCandidatures } = require('../src/candidatures');
    const cand = creerCandidatures({ db: m.db, config: m.config, commandes: m.commandes, maintenant: () => now });
    cand.demarrer('R1', 'retenu1');
    cand.recevoirFormulaire('R1', [{ label: 'Q', valeur: 'R' }]);
    cand.decider(1, 'retenir');
    const bob = creerBob({ config: m.config, db: m.db, commandes: m.commandes, coaching: m.coaching, candidatures: cand, maintenant: () => now,
      client: { isReady: () => true, users: { fetch: async (id) => ({ send: async (c) => dms.push([id, c.content, c.components]) }) } }, serveur: null });
    now = new Date('2026-12-01T20:00:00Z'); await bob.relancerCandidats();
    assert.strictEqual(dms.length, 0);
    now = new Date('2026-12-02T10:30:00Z'); await bob.relancerCandidats(); await bob.relancerCandidats();
    assert.strictEqual(dms.length, 1);
    assert.match(dms[0][1], /Petit rappel/);
    assert.match(urls(dms[0][2])[0], /connexion\/bob\?t=/);
    now = new Date('2026-12-04T11:00:00Z'); await bob.relancerCandidats(); await bob.relancerCandidats();
    assert.strictEqual(dms.length, 2);
    assert.match(dms[1][1], /Dernier rappel/);
  } finally { await m.fermer(); }
});

test('suppression d\'une candidature par l\'admin : la personne peut recommencer ; anti-spam 5 envois par heure', async () => {
  const m = await monter({ avecCandidatures: true, bob: { idDepuisPseudo: async () => '910000000000000001', candidatureRecue: async () => {} } });
  try {
    const envoyer = () => fetch(`${m.base}/api/candidature/formulaire`, { method: 'POST', headers: { 'Content-Type': 'application/json', cookie: cookieSession('910000000000000001', 'noflow') },
      body: JSON.stringify({ reponses: { nom: 'Test' } }) });
    assert.strictEqual((await envoyer()).status, 200);
    assert.strictEqual((await envoyer()).status, 409, 'une candidature en cours bloque un nouvel envoi');
    const admin = cookieSession(ADMIN, 'admin');
    assert.match(await (await m.get('/admin/candidatures/1', { cookie: admin })).text(), /Supprimer la candidature/);
    assert.strictEqual((await m.poster('/admin/candidatures/1/supprimer', {}, { cookie: cookieSession('X') })).status, 403);
    assert.strictEqual((await m.poster('/admin/candidatures/1/supprimer', {}, { cookie: admin })).status, 303);
    assert.strictEqual(m.candidatures.parDiscord('910000000000000001'), null);
    assert.strictEqual((await envoyer()).status, 200, 'il peut recommencer');
    await envoyer(); await envoyer();
    assert.strictEqual((await envoyer()).status, 429, '6e envoi dans l\'heure bloqué');
  } finally { await m.fermer(); }
});

test('envoi de vidéo : le dossier des vidéos est recréé s\'il a été supprimé', async () => {
  const m = await monter({ avecCandidatures: true });
  try {
    m.candidatures.demarrer('V1', 'v1'); m.candidatures.recevoirFormulaire('V1', [{ label: 'Q', valeur: 'R' }]); m.candidatures.decider(1, 'retenir');
    require('fs').rmSync(m.candidatures.dossierVideos, { recursive: true, force: true });
    const r = await fetch(`${m.base}/api/candidature/video`, { method: 'POST', headers: { cookie: cookieSession('V1', 'v1'), 'Content-Type': 'video/quicktime' }, body: Buffer.alloc(3 * 1024 * 1024, 1) });
    assert.strictEqual(r.status, 200);
    assert.strictEqual(m.candidatures.parId(1).statut, 'video');
  } finally { await m.fermer(); }
});

test('candidature validée : paiement par mobile money OU par carte (offre Whop cachée) ; carte détectée par le rôle Elite', async () => {
  const CARTE = 'https://whop.com/checkout/plan_carte_cachee';
  const m = await monter({ avecCandidatures: true, config: configTest({ LIEN_CARTE_ELITE: CARTE }) });
  try {
    const CID = '500000000000000009';
    const d = fauxBobDiscord(m);
    const c = m.candidatures.demarrer(CID, 'awa');
    m.candidatures.recevoirFormulaire(CID, [{ label: 'Q', valeur: 'R' }]);
    m.db.prepare("UPDATE candidatures SET statut = 'video' WHERE id = ?").run(c.id);
    assert.ok((await d.bob.appliquerDecision(c.id, 'valider')).ok);
    const lienMobile = m.candidatures.lienPaiement(m.candidatures.parId(c.id));
    const dm = d.dms.find(([id, t]) => id === CID && /validée/.test(t));
    const [boutonMobile, boutonCarte] = urls(dm[2]);
    assert.ok(boutonMobile.endsWith(`retour=${encodeURIComponent(new URL(lienMobile).pathname)}`), 'mobile money : bouton personnel');
    assert.strictEqual(boutonCarte, CARTE);

    const cookie = cookieSession(CID, 'awa');
    const suivi = await (await m.get('/coaching/elite/candidature', { cookie })).text();
    assert.match(suivi, /Payer par mobile money/);
    assert.ok(suivi.includes(`href="${CARTE}"`));
    assert.match(await (await m.get(new URL(lienMobile).pathname, { cookie })).text(), /Payer plutôt par carte bancaire/);

    // Paiement par carte sur Whop : Whop donne le rôle Elite.
    const membre = { id: CID, roles: { cache: { has: (r) => r === ROLES.elite || r === ROLES.attente } } };
    assert.strictEqual(await d.bob.paiementCarteDetecte(membre), true);
    assert.strictEqual(await d.bob.paiementCarteDetecte(membre), false, 'une seule fois');
    assert.ok(d.dms.some(([id, t]) => id === CID && /Paiement reçu/.test(t)));
    assert.ok(d.dms.some(([id, t]) => id === ADMIN && /par carte/.test(t)));
    assert.match(await (await m.get('/coaching/elite/candidature', { cookie })).text(), /intégration est confirmée/);
    assert.strictEqual((await m.get(new URL(lienMobile).pathname, { cookie })).status, 410, 'le lien mobile money ne peut plus servir');
  } finally { await m.fermer(); }
});

test('connexion par pseudo : Bob envoie « C\'est bien moi, continuer » ; le clic connecte et ramène à la page demandée', async () => {
  const PID = '600000000000000001';
  const holder = {};
  const m = await monter({ avecCandidatures: true, connecte: false, bob: {
    idDepuisPseudo: async (p) => (p.toLowerCase() === 'awa_27' ? PID : null),
    envoyerConnexion: (...a) => holder.bob.envoyerConnexion(...a),
  } });
  try {
    const d = fauxBobDiscord(m);
    holder.bob = d.bob;
    const demander = (pseudo, retour = '/community') => m.poster('/connexion/pseudo', { pseudo, retour });

    // Pseudo inconnu : on propose de rejoindre le serveur.
    const inconnu = await demander('personne');
    assert.strictEqual(inconnu.status, 404);
    assert.match(await inconnu.text(), /pas sur le serveur Overmaxx[\s\S]*Rejoindre le Discord/);

    // Pseudo trouvé : Bob envoie le bouton, la page dit de regarder sur Discord.
    const envoye = await demander('@Awa_27');
    assert.strictEqual(envoye.status, 200);
    const page = await envoye.text();
    assert.match(page, /Regarde sur Discord/);
    assert.match(page, /href="https:\/\/discord\.com\/channels\/@me"/, 'bouton Ouvrir Discord');
    const [, texte, composants] = d.dms.find(([id]) => id === PID);
    assert.match(texte, /Ce n'est pas toi \? Ignore/);
    const bouton = composants[0].components[0].data;
    assert.strictEqual(bouton.label, 'C\'est bien moi, continuer');
    assert.match(bouton.url, /\/connexion\/bob\?t=.*retour=%2Fcommunity$/);

    // Le clic connecte (dans le navigateur qui clique) et ouvre la page demandée.
    const clic = await m.get(bouton.url.replace('http://localhost', ''));
    assert.strictEqual(clic.headers.get('location'), '/community');
    const cookie = clic.headers.get('set-cookie').split(';')[0];
    assert.match(clic.headers.get('set-cookie'), /Max-Age=2592000/, 'connexion gardée 30 jours');
    assert.match(await (await m.get('/community', { cookie })).text(), /Payer par mobile money/);

    // Anti-abus : 3 boutons par demi-heure pour un même compte ; retour vers un autre site refusé.
    await demander('awa_27'); await demander('awa_27');
    assert.strictEqual((await demander('awa_27')).status, 429);
    assert.match(await (await m.poster('/connexion/pseudo', { pseudo: 'x', retour: '/\\evil.com' })).text(), /name="retour" value="\/"/);
    assert.strictEqual((await m.get('/connexion/bob?t=faux&retour=//evil.com')).status, 400);
  } finally { await m.fermer(); }
});

test('paiement confirmé en étant connecté : Bob donne le rôle tout de suite et retire En Attente', async () => {
  const m = await monter({ avecCandidatures: true });
  try {
    const roles = new Set([ROLES.attente]);
    const dms = [];
    const bob = creerBob({ config: m.config, db: m.db, commandes: m.commandes, coaching: m.coaching, candidatures: m.candidatures,
      client: { isReady: () => true, users: { fetch: async (id) => ({ send: async (c) => dms.push([id, c.content, c.components]) }) } },
      serveur: { id: 'guild', members: { fetch: async () => ({ roles: { cache: { has: (r) => roles.has(r) }, add: async (r) => roles.add(r), remove: async (r) => roles.delete(r) } }) } } });
    const membre = { discord_id: 'P1', programme: 'community', statut: 'actif', acces_jusqu_au: new Date(Date.now() + 30 * 86400000).toISOString() };
    await bob.apresPaiement(membre, { type: 'inscription', ref: 'REF123' });
    assert.ok(roles.has(ROLES.community) && !roles.has(ROLES.attente));
    assert.match(dms[0][1], /bienvenue dans Overmaxx Community/);
    assert.deepStrictEqual(urls(dms[0][2]), ['http://localhost/acces/REF123']);
    await bob.apresPaiement(membre, { type: 'renouvellement', ref: 'REF124' });
    assert.match(dms[1][1], /Renouvellement confirmé/);
    await bob.apresPaiement({ ...membre, discord_id: null }, { type: 'inscription' });
    assert.strictEqual(dms.length, 2, 'sans compte Discord : rien');
  } finally { await m.fermer(); }
});

test('connexion par code (application installée) et appareil reconnu : « Me reconnecter » sans nouveau message de Bob', async () => {
  const PID = '600000000000000002';
  const holder = {};
  const m = await monter({ avecCandidatures: true, connecte: false, bob: {
    idDepuisPseudo: async (p) => (p.toLowerCase() === 'awa_27' ? PID : null),
    envoyerConnexion: (...a) => holder.bob.envoyerConnexion(...a),
  } });
  try {
    const d = fauxBobDiscord(m);
    holder.bob = d.bob;
    const cookies = (r) => Object.fromEntries(r.headers.getSetCookie().map((c) => c.split(';')[0].split('=')).map(([n, ...v]) => [n, v.join('=')]));
    const demander = async () => {
      const page = await (await m.poster('/connexion/pseudo', { pseudo: 'awa_27', retour: '/app' })).text();
      const [, texte] = d.dms.filter(([id]) => id === PID).at(-1);
      return { page, demande: page.match(/name="demande" value="([^"]+)"/)[1], code: texte.match(/Ton code : \*\*(\d{6})\*\*/)[1], texte };
    };

    // Bob envoie un code ; la page (dans l'application) a le champ du code.
    const a = await demander();
    assert.match(a.page, /action="\/connexion\/code"[\s\S]*autocomplete="one-time-code"/);
    assert.match(a.texte, /valable 10 minutes[\s\S]*ne donne ce code à personne/);
    const mauvais = await m.poster('/connexion/code', { demande: a.demande, code: a.code === '000000' ? '111111' : '000000' });
    assert.strictEqual(mauvais.status, 400);
    assert.match(await mauvais.text(), /pas le bon code/);
    const bon = await m.poster('/connexion/code', { demande: a.demande, code: `${a.code.slice(0, 3)} ${a.code.slice(3)}` });
    assert.strictEqual(bon.status, 303);
    assert.strictEqual(bon.headers.get('location'), '/app');
    const c1 = cookies(bon);
    assert.ok(c1.ovx_session && c1.ovx_appareil, 'session ouverte et appareil reconnu');
    assert.match(bon.headers.getSetCookie().find((c) => c.startsWith('ovx_appareil=')), /Max-Age=31536000/, 'reconnu un an');
    // Double envoi du même bon code (bouton + envoi automatique) : pas d'erreur, il est connecté.
    const double = await m.poster('/connexion/code', { demande: a.demande, code: a.code });
    assert.strictEqual(double.status, 303);
    assert.strictEqual(double.headers.get('location'), '/app');
    assert.strictEqual((await m.poster('/connexion/code', { demande: a.demande, code: '123x' })).status, 410, 'code déjà servi : plus d\'essais possibles');

    // Se déconnecter : l'appareil reste reconnu ; l'accueil et la page de connexion proposent « Me reconnecter ».
    const appareil = `ovx_appareil=${c1.ovx_appareil}`;
    const sortie = await m.get('/deconnexion', { cookie: `ovx_session=${c1.ovx_session}; ${appareil}` });
    assert.ok(!sortie.headers.getSetCookie().some((c) => c.startsWith('ovx_appareil=;')), 'appareil gardé');
    const accueil = await (await m.get('/', { cookie: appareil })).text();
    assert.match(accueil, /Content de te revoir, <b>awa_27<\/b>[\s\S]*action="\/connexion\/appareil"[\s\S]*Me reconnecter/);
    assert.match(await (await m.get('/connexion?retour=%2Fapp', { cookie: appareil })).text(), /Bon retour[\s\S]*Cet appareil est reconnu[\s\S]*Me reconnecter/);
    const avant = d.dms.length;
    const retour = await m.poster('/connexion/appareil', { retour: '/app' }, { cookie: appareil });
    assert.strictEqual(retour.status, 303);
    assert.strictEqual(retour.headers.get('location'), '/app');
    assert.ok(cookies(retour).ovx_session, 'reconnecté');
    assert.strictEqual(d.dms.length, avant, 'sans nouveau message de Bob');

    // Le jeton de l'appareil ne vaut pas une session ; sans appareil reconnu, « Me reconnecter » renvoie vers la connexion.
    assert.match(await (await m.get('/community', { cookie: `ovx_session=${c1.ovx_appareil}` })).text(), /Recevoir mon code/);
    assert.strictEqual((await m.poster('/connexion/appareil', { retour: '/app' })).headers.get('location'), '/connexion?retour=%2Fapp');

    // « Ce n'est pas toi ? » et « Changer de compte » : l'appareil est oublié.
    const oubli = await m.get('/connexion/oublier?retour=%2Fapp', { cookie: appareil });
    assert.ok(oubli.headers.getSetCookie().some((c) => c.startsWith('ovx_appareil=;')));
    assert.strictEqual(oubli.headers.get('location'), '/connexion?retour=%2Fapp');
    assert.ok((await m.get('/deconnexion?autre=1', { cookie: appareil })).headers.getSetCookie().some((c) => c.startsWith('ovx_appareil=;')));

    // 3 mauvais codes : le code ne vaut plus rien.
    const b = await demander();
    for (let k = 0; k < 2; k++) assert.strictEqual((await m.poster('/connexion/code', { demande: b.demande, code: 'abc' })).status, 400);
    assert.strictEqual((await m.poster('/connexion/code', { demande: b.demande, code: 'abc' })).status, 429);
    assert.strictEqual((await m.poster('/connexion/code', { demande: b.demande, code: b.code })).status, 410);
  } finally { await m.fermer(); }
});

test('pages de présentation publiques : vidéo puis « Rejoindre » (bloqué jusqu\'à la fin de la vidéo) ; Community : mobile money ou carte, déjà membre', async () => {
  const { monter: monter2, cookieSession: cs } = require('./aide');
  const m = await monter2({ connecte: false });
  try {
    m.config.offres.community.wistiaVsl = 'abc123'; m.config.offres.community.lienCarte = 'https://whop.com/overmaxx/community/';
    const p = await m.get('/rejoindre/community');
    assert.strictEqual(p.status, 200, 'sans connexion');
    const t = await p.text();
    assert.match(t, /Overmaxx Community[\s\S]*wistia\.net\/embed\/iframe\/abc123[\s\S]*Génère 1 500 € par mois[\s\S]*Notre formation privée[\s\S]*href="\/community"[^>]*aria-disabled="true"[^>]*>Rejoindre[\s\S]*Regarde la vidéo jusqu'au bout/);
    const e = await (await m.get('/rejoindre/elite')).text();
    assert.match(e, /Overmaxx Elite[\s\S]*3 à 5 lives individuels[\s\S]*href="\/coaching\/elite"[^>]*>Rejoindre/);
    const pay = await (await m.get('/community', { cookie: cs('700000000000000077', 'nouveau') })).text();
    assert.match(pay, /Payer par mobile money[\s\S]*SasPay[\s\S]*href="https:\/\/whop\.com\/overmaxx\/community\/"[^>]*>Payer par carte/);
    m.parcours.assurer('700000000000000078', { pseudo: 'eleve' });
    assert.match(await (await m.get('/community', { cookie: cs('700000000000000078', 'eleve') })).text(), /Tu es déjà membre/);
  } finally { await m.fermer(); }
});
