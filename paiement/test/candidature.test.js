'use strict';

const test = require('node:test');
const assert = require('node:assert');
const crypto = require('crypto');
const fs = require('fs');
const { monter, configTest, fauxOAuth, cookieSession, ADMIN, ROLES } = require('./aide');
const { creerBob } = require('../src/bob');

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

test('candidature Elite : Discord → formulaire Tally → examen → retenu → vidéo → validé → lien de paiement', async () => {
  const oauth = fauxOAuth({});
  oauth.identifier = async () => ({ id: '500000000000000001', pseudo: 'koffi', accessToken: 'tok' });
  const config = configTest({ TALLY_FORM_ID: 'abc123' });
  const holder = {};
  const m = await monter({ oauth, config, avecCandidatures: true, bob: { candidatureRecue: (...a) => holder.bob.candidatureRecue(...a), videoRecue: (...a) => holder.bob.videoRecue(...a), appliquerDecision: (...a) => holder.bob.appliquerDecision(...a) } });
  try {
    const d = fauxBobDiscord(m);
    holder.bob = d.bob;
    const CID = '500000000000000001';
    // Sans session : bouton de connexion Discord.
    const accueil = await (await m.get('/coaching/elite/candidature')).text();
    assert.match(accueil, /Postuler/);
    assert.match(accueil, /href="https:\/\/discord\.com\/oauth2\/authorize\?state=/, 'connexion web en secours');

    // Connexion Discord : rejoint le serveur avec le rôle Attente, candidature créée.
    const st = new URL((await m.get('/discord/candidature')).headers.get('location')).searchParams.get('state');
    const cb = await m.get(`/discord/callback?code=x&state=${encodeURIComponent(st)}`);
    assert.strictEqual(cb.headers.get('location'), '/coaching/elite/candidature');
    assert.deepStrictEqual(oauth.ajouts, [[CID, [ROLES.attente]]]);
    const cookie = cookieSession(CID, 'koffi');

    // Formulaire Tally avec le champ caché discord_id.
    const page = await (await m.get('/coaching/elite/candidature', { cookie })).text();
    assert.match(page, new RegExp(`tally\\.so/embed/abc123\\?discord_id=${CID}`));
    assert.strictEqual((await tally(m, [{ label: 'discord_id', value: CID }, { label: 'Objectif', value: '10k abonnés' }])).status, 200);
    assert.deepStrictEqual(await (await m.get('/api/candidature', { cookie })).json(), { statut: 'examen' });
    assert.match(await (await m.get('/coaching/elite/candidature', { cookie })).text(), /sous 24 heures/);
    assert.ok(d.dms.some(([id, t]) => id === CID && /bien reçu/.test(t)));
    const alerte = d.dms.find(([id, t]) => id === ADMIN && /Nouvelle candidature/.test(t));
    assert.match(alerte[1], /10k abonnés/);
    assert.doesNotMatch(alerte[1], /discord_id/);
    assert.deepStrictEqual(alerte[2][0].components.map((b) => b.data.custom_id), ['cand:retenir:1', 'cand:refuser:1']);

    // L'admin clique « Retenir » dans Discord.
    const maj = [];
    await d.bob.surInteraction({ user: { id: ADMIN }, isButton: () => true, customId: 'cand:retenir:1', message: { content: 'x' }, update: async (o) => maj.push(o), reply: async (o) => maj.push(o) });
    assert.match(maj[0].content, /Retenu/);
    assert.ok(d.dms.some(([id, t]) => id === CID && /vidéo d'1 minute/.test(t)));
    assert.match(await (await m.get('/coaching/elite/candidature', { cookie })).text(), /Envoyer ma vidéo/);

    // Envoi de la vidéo.
    const refus = await fetch(`${m.base}/api/candidature/video`, { method: 'POST', headers: { cookie, 'Content-Type': 'image/png' }, body: Buffer.alloc(10) });
    assert.strictEqual(refus.status, 400);
    const video = Buffer.alloc(2048, 7);
    const env = await fetch(`${m.base}/api/candidature/video`, { method: 'POST', headers: { cookie, 'Content-Type': 'video/mp4' }, body: video });
    assert.strictEqual(env.status, 200);
    const c = m.candidatures.parId(1);
    assert.strictEqual(c.statut, 'video');
    const chemin = m.candidatures.cheminVideo(c);
    assert.strictEqual(fs.statSync(chemin).size, 2048);
    assert.ok(d.dms.some(([id, t]) => id === ADMIN && /Vidéo de candidature reçue/.test(t)));

    // Admin : page des candidatures et lecture de la vidéo (réservées à l'admin).
    assert.strictEqual((await m.get('/admin/videos/1', { cookie })).status, 403);
    const admin = cookieSession(ADMIN, 'admin');
    const liste = await (await m.get('/admin/candidatures', { cookie: admin })).text();
    assert.match(liste, /Vidéo à regarder/);
    assert.match(liste, /\/admin\/videos\/1/);
    const lecture = await m.get('/admin/videos/1', { cookie: admin, range: 'bytes=0-99' });
    assert.strictEqual(lecture.status, 206);

    // Validation depuis la page admin : vidéo supprimée, lien de paiement unique envoyé.
    assert.strictEqual((await m.poster('/admin/candidatures/1/valider', {}, { cookie: admin })).status, 303);
    assert.ok(!fs.existsSync(chemin), 'vidéo supprimée');
    const finale = m.candidatures.parId(1);
    assert.strictEqual(finale.statut, 'valide');
    const lien = m.candidatures.lienPaiement(finale);
    assert.ok(d.dms.some(([id, t]) => id === CID && t.includes(lien)));
    const pageFin = await (await m.get('/coaching/elite/candidature', { cookie })).text();
    assert.match(pageFin, /Confirmer mon intégration/);
    assert.match(await (await m.get(new URL(lien).pathname)).text(), /327/);
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
    const lien = reponses[0].content.match(/https?:\/\/\S+/)[0];
    assert.match(lien, /\/connexion\/bob\?t=.*retour=%2Fcoaching%2Felite%2Fcandidature/);
    assert.strictEqual(reponses[0].flags, 64, 'visible par lui seul');

    const chemin = lien.replace('http://localhost', '');
    const r1 = await m.get(chemin);
    assert.strictEqual(r1.status, 302);
    assert.strictEqual(r1.headers.get('location'), '/coaching/elite/candidature');
    const cookie = r1.headers.get('set-cookie').split(';')[0];
    assert.deepStrictEqual(await (await m.get('/api/candidature', { cookie })).json(), { statut: 'formulaire' });
    assert.strictEqual((await m.get(chemin)).status, 400, 'usage unique');
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
