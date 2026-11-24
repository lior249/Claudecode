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

test('candidature Elite : formulaire 1 (nom + pseudo Discord) → examen → retenu → formulaire 2 (vidéo) → validé → paiement', async () => {
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

    // Formulaire 1, sans connexion.
    const page = await (await m.get('/coaching/elite')).text();
    assert.match(page, /Quel est ton nom \?/);
    assert.match(page, /Ton formulaire est en cours de traitement/);
    let r = await envoyer({ reponses: { nom: '' } });
    assert.deepStrictEqual(await r.json(), { champ: 'nom', erreur: 'Cette question est obligatoire.' });
    r = await envoyer({ reponses: { nom: 'Koffi Mensah', discord: 'inconnu' } });
    const e = await r.json();
    assert.strictEqual(e.champ, 'discord');
    assert.match(e.erreur, /introuvable/);
    r = await envoyer({ reponses: { nom: 'Koffi Mensah', discord: '@Koffi_99' } });
    assert.strictEqual(r.status, 200);
    assert.strictEqual(m.candidatures.parDiscord(CID).statut, 'examen');
    assert.ok(d.dms.some(([id, t]) => id === CID && /bien reçu/.test(t)));
    const alerte = d.dms.find(([id, t]) => id === ADMIN && /Nouvelle candidature/.test(t));
    assert.match(alerte[1], /Koffi Mensah/);
    assert.strictEqual((await envoyer({ reponses: { nom: 'X', discord: 'koffi_99' } })).status, 409, 'une seule candidature');

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
    assert.ok(d.dms.some(([id, , c]) => id === CID && urls(c).includes(lienPaiement)), 'lien de paiement dans un bouton');
    const suivi = await (await m.get('/coaching/elite/candidature', { cookie })).text();
    assert.match(suivi, /Payer par mobile money/);
    assert.doesNotMatch(suivi, /carte bancaire/, 'pas de lien carte configuré : mobile money seulement');
    assert.match(await (await m.get(new URL(lienPaiement).pathname)).text(), /327/);
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

test('question Discord : tutoriel en 3 images, servies avec cache', async () => {
  const m = await monter({ avecCandidatures: true });
  try {
    const page = await (await m.get('/coaching/elite')).text();
    assert.match(page, /Où trouver mon pseudo \?/);
    assert.match(page, /Rejoindre le serveur Discord/);
    assert.match(page, /"lienDiscord":"https:\/\/discord\.gg\/test"/);
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
    const r = await fetch(`${m.base}/api/candidature/formulaire`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reponses: { nom: 'Ama', discord: 'ama_d' } }) });
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

test('messages privés impossibles : pas de fil automatique, l\'admin est prévenu (une fois par jour, avec la raison)', async () => {
  const m = await monter({ avecCandidatures: true });
  try {
    const recus = [];
    let creations = 0;
    const client = { isReady: () => true, users: { fetch: async (id) => ({ send: async (c) => {
      if (id === 'F3') throw new Error('Cannot send messages to this user due to having no mutual guilds');
      if (id !== ADMIN) throw new Error('Cannot send messages to this user');
      recus.push([id, c.content]);
    } }) } };
    const serveur = { members: { fetch: async () => null }, channels: { fetch: async () => ({ threads: { create: async () => { creations++; } } }) } };
    const bob = creerBob({ config: m.config, db: m.db, commandes: m.commandes, coaching: m.coaching, candidatures: m.candidatures, client, serveur });
    assert.strictEqual(await bob.notifier.membre('F1', 'Bonjour'), false);
    await bob.notifier.membre('F1', 'Encore');
    assert.strictEqual(creations, 0, 'aucun fil créé');
    assert.strictEqual(recus.filter(([id, t]) => id === ADMIN && /messages privés sont fermés/.test(t)).length, 1);
    await bob.notifier.membre('F3', 'Coucou');
    assert.ok(recus.some(([id, t]) => id === ADMIN && /pas \(ou plus\) sur le serveur/.test(t)));
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
    const envoyer = () => fetch(`${m.base}/api/candidature/formulaire`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reponses: { nom: 'Test', discord: 'noflow' } }) });
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
    assert.deepStrictEqual(urls(dm[2]), [lienMobile, CARTE], 'deux boutons : mobile money et carte');

    const cookie = cookieSession(CID, 'awa');
    const suivi = await (await m.get('/coaching/elite/candidature', { cookie })).text();
    assert.match(suivi, /Payer par mobile money/);
    assert.ok(suivi.includes(`href="${CARTE}"`));
    assert.match(await (await m.get(new URL(lienMobile).pathname)).text(), /Payer plutôt par carte bancaire/);

    // Paiement par carte sur Whop : Whop donne le rôle Elite.
    const membre = { id: CID, roles: { cache: { has: (r) => r === ROLES.elite || r === ROLES.attente } } };
    assert.strictEqual(await d.bob.paiementCarteDetecte(membre), true);
    assert.strictEqual(await d.bob.paiementCarteDetecte(membre), false, 'une seule fois');
    assert.ok(d.dms.some(([id, t]) => id === CID && /Paiement reçu/.test(t)));
    assert.ok(d.dms.some(([id, t]) => id === ADMIN && /par carte/.test(t)));
    assert.match(await (await m.get('/coaching/elite/candidature', { cookie })).text(), /intégration est confirmée/);
    assert.strictEqual((await m.get(new URL(lienMobile).pathname)).status, 410, 'le lien mobile money ne peut plus servir');
  } finally { await m.fermer(); }
});
