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
    const lien = d.dms.find(([id, t]) => id === CID && /retenu/.test(t))[1].match(/https?:\/\/\S+/)[0];
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
    assert.ok(d.dms.some(([id, t]) => id === CID && t.includes(lienPaiement)));
    assert.match(await (await m.get('/coaching/elite/candidature', { cookie })).text(), /Confirmer mon intégration/);
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
