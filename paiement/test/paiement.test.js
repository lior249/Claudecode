'use strict';

const test = require('node:test');
const assert = require('node:assert');
const crypto = require('crypto');
const { monter, configTest, signerWebhook, SECRET_WEBHOOK } = require('./aide');
const { signatureValide, creerClientSaspay } = require('../src/saspay');
const { jetonMembre, lireJetonMembre } = require('../src/liens');

const ref = (s) => s.metadata.ref;

test('signature webhook SasPay : valide, falsifiée, trop vieille', () => {
  const corps = '{"event":"transaction.success"}';
  const h = signerWebhook(corps);
  assert.ok(signatureValide(Buffer.from(corps), h['X-Webhook-Signature'], h['X-Webhook-Timestamp'], SECRET_WEBHOOK));
  assert.ok(!signatureValide(Buffer.from(`${corps} `), h['X-Webhook-Signature'], h['X-Webhook-Timestamp'], SECRET_WEBHOOK));
  const vieux = signerWebhook(corps, Math.floor(Date.now() / 1000) - 600);
  assert.ok(!signatureValide(Buffer.from(corps), vieux['X-Webhook-Signature'], vieux['X-Webhook-Timestamp'], SECRET_WEBHOOK));
});

test('jeton de renouvellement infalsifiable', () => {
  const j = jetonMembre('awa@example.com', 'x'.repeat(40));
  assert.strictEqual(lireJetonMembre(j, 'x'.repeat(40)), 'awa@example.com');
  const faux = `${Buffer.from('autre@example.com').toString('base64url')}.${j.split('.')[1]}`;
  assert.strictEqual(lireJetonMembre(faux, 'x'.repeat(40)), null);
});

test('Community : accueil → formulaire → SasPay → statut → guide Whop + Discord', async () => {
  const m = await monter();
  try {
    assert.strictEqual((await m.get('/')).headers.get('location'), '/community');
    assert.match(await (await m.get('/community')).text(), /Payer par mobile money/);
    assert.strictEqual((await m.get('/paiement')).headers.get('location'), '/community/paiement');

    const res = await m.poster('/community/paiement', { nom: 'Awa Sossou', email: 'Awa@Example.com' });
    assert.strictEqual(res.status, 303);
    const s = m.saspay.derniere();
    assert.strictEqual(s.amount, '19025.00');
    assert.deepStrictEqual({ ...s.metadata, ref: undefined }, { ref: undefined, type: 'inscription', programme: 'community' });

    assert.match(await (await m.get(`/confirmation/${ref(s)}`)).text(), /Vérification du paiement/);
    assert.strictEqual((await m.etat(ref(s))).etat, 'en_attente');
    m.saspay.payer(s.id);
    const e = await m.etat(ref(s));
    assert.strictEqual(e.redirection, `/acces/${ref(s)}`);

    const guide = await (await m.get(e.redirection)).text();
    assert.match(guide, /awa@example\.com/);
    assert.match(guide, /whop\.com\/checkout\/plan_com/);
    assert.match(guide, /Connecter mon Discord/);

    const membre = m.db.prepare('SELECT * FROM membres').get();
    assert.strictEqual(membre.programme, 'community');
    assert.strictEqual(membre.prix_renouvellement, '3280.00');
    const jours = (new Date(membre.acces_jusqu_au) - Date.now()) / 86400000;
    assert.ok(jours > 29.9 && jours <= 30);

    // Réinscription tant que l'accès est actif : refusée, renvoi vers le renouvellement.
    const re = await m.poster('/community/paiement', { nom: 'Awa', email: 'awa@example.com' });
    assert.strictEqual(re.status, 409);
    assert.match(await re.text(), /community\/renouveler\?m=/);
  } finally { await m.fermer(); }
});

test('prix garanti : un membre inscrit à 5 € renouvelle à 5 € même si le tarif augmente', async () => {
  const m = await monter();
  try {
    await m.poster('/community/paiement', { nom: 'Awa', email: 'awa@example.com' });
    m.saspay.payer(m.saspay.derniere().id);
    await m.etat(ref(m.saspay.derniere()));
    m.config.offres.community.prixRenouvellement = '4590'; // hausse : 7 €
    const avant = new Date(m.db.prepare('SELECT acces_jusqu_au a FROM membres').get().a);

    const page = await (await m.get(`/community/renouveler?m=${jetonMembre('awa@example.com', m.config.secretApp)}`)).text();
    assert.match(page, /3 ?280|3 280/);
    const res = await m.poster('/community/renouveler', { nom: 'Awa', email: 'pirate@example.com', m: jetonMembre('awa@example.com', m.config.secretApp) });
    assert.strictEqual(res.status, 303);
    const s = m.saspay.derniere();
    assert.strictEqual(s.amount, '3280.00');
    assert.strictEqual(s.customer_email, 'awa@example.com');
    m.saspay.payer(s.id);
    assert.strictEqual((await m.etat(ref(s))).redirection, `/renouvele/${ref(s)}`);
    const apres = new Date(m.db.prepare('SELECT acces_jusqu_au a FROM membres').get().a);
    assert.strictEqual(apres - avant, 30 * 86400000);

    // Un nouveau membre paie le nouveau tarif garanti.
    await m.poster('/community/paiement', { nom: 'Koffi', email: 'koffi@example.com' });
    m.saspay.payer(m.saspay.derniere().id);
    await m.etat(ref(m.saspay.derniere()));
    assert.strictEqual(m.db.prepare("SELECT prix_renouvellement p FROM membres WHERE email = 'koffi@example.com'").get().p, '4590.00');
  } finally { await m.fermer(); }
});

test('après expiration : renouvellement refusé, il faut repayer l\'entrée', async () => {
  const m = await monter();
  try {
    await m.poster('/community/paiement', { nom: 'Awa', email: 'awa@example.com' });
    m.saspay.payer(m.saspay.derniere().id);
    await m.etat(ref(m.saspay.derniere()));
    m.db.prepare("UPDATE membres SET acces_jusqu_au = '2020-01-01T00:00:00.000Z', statut = 'expire'").run();
    const res = await m.poster('/community/renouveler', { nom: 'Awa', email: 'awa@example.com' });
    assert.strictEqual(res.status, 404);
    assert.match(await res.text(), /repayer l'entrée/);
    // Il peut se réinscrire au prix d'entrée : accès réactivé, Whop remis à zéro.
    m.db.prepare("UPDATE membres SET whop_membership_id = 'mem_old'").run();
    assert.strictEqual((await m.poster('/community/paiement', { nom: 'Awa', email: 'awa@example.com' })).status, 303);
    assert.strictEqual(m.saspay.derniere().amount, '19025.00');
    m.saspay.payer(m.saspay.derniere().id);
    await m.etat(ref(m.saspay.derniere()));
    const mb = m.db.prepare('SELECT * FROM membres').get();
    assert.strictEqual(mb.statut, 'actif');
    assert.strictEqual(mb.whop_membership_id, null);
  } finally { await m.fermer(); }
});

test('Elite : page de candidature sans prix, paiement uniquement par lien personnel à usage unique', async () => {
  const m = await monter({ config: configTest({ TALLY_FORM_ID: 'abc123', WISTIA_VSL_ELITE: 'vsl1234567' }) });
  try {
    const cand = await (await m.get('/coaching/elite')).text();
    assert.match(cand, /Postuler/);
    assert.match(cand, /vsl1234567/);
    assert.doesNotMatch(cand, /327|FCFA/);
    assert.strictEqual((await m.get('/coaching/elite/paiement/inventeAAAAAAAAAAAAAAAAAA')).status, 404);

    const { lien } = m.commandes.creerInvitation('Koffi');
    const chemin = new URL(lien).pathname;
    assert.match(await (await m.get(chemin)).text(), /327/);
    assert.strictEqual((await m.poster(chemin, { nom: 'Koffi', email: 'koffi@example.com' })).status, 303);
    const s = m.saspay.derniere();
    assert.strictEqual(s.amount, '327980.00');
    m.saspay.payer(s.id);
    await m.etat(ref(s));
    const mb = m.db.prepare("SELECT * FROM membres WHERE programme = 'elite'").get();
    assert.strictEqual(mb.email, 'koffi@example.com');
    assert.ok((new Date(mb.acces_jusqu_au) - Date.now()) / 86400000 > 89.9);
    assert.match(await (await m.get(`/acces/${ref(s)}`)).text(), /plan_eli/);
    assert.strictEqual((await m.get(chemin)).status, 410, 'lien déjà utilisé');
  } finally { await m.fermer(); }
});

test('paiement non conforme ou échoué : aucun accès', async () => {
  for (const opts of [{ montantPaye: '100.00' }, { devise: 'XAF' }]) {
    const { fauxSaspay } = require('./aide');
    const m = await monter({ saspay: fauxSaspay(opts) });
    try {
      await m.poster('/community/paiement', { nom: 'Awa', email: 'awa@example.com' });
      m.saspay.payer(m.saspay.derniere().id);
      assert.strictEqual((await m.etat(ref(m.saspay.derniere()))).etat, 'echec');
      assert.strictEqual(m.db.prepare('SELECT COUNT(*) n FROM membres').get().n, 0);
    } finally { await m.fermer(); }
  }
});

test('webhook SasPay seul : accès créé ; webhook non signé refusé', async () => {
  const m = await monter();
  try {
    await m.poster('/community/paiement', { nom: 'Koffi', email: 'koffi@example.com' });
    const s = m.saspay.derniere();
    m.saspay.payer(s.id);
    const corps = JSON.stringify({ event: 'transaction.success', data: { id: s.transaction, type: 'PAIEMENT' } });
    assert.strictEqual((await fetch(`${m.base}/webhooks/saspay`, { method: 'POST', headers: signerWebhook(corps), body: corps })).status, 200);
    assert.strictEqual(m.db.prepare('SELECT COUNT(*) n FROM membres').get().n, 1);
    const faux = await fetch(`${m.base}/webhooks/saspay`, { method: 'POST', headers: { 'X-Webhook-Signature': 'x', 'X-Webhook-Timestamp': '1' }, body: corps });
    assert.strictEqual(faux.status, 401);
  } finally { await m.fermer(); }
});

test('connexion Discord après paiement : membre relié et ajouté au serveur avec son rôle', async () => {
  const m = await monter();
  try {
    await m.poster('/community/paiement', { nom: 'Awa', email: 'awa@example.com' });
    const s = m.saspay.derniere();
    m.saspay.payer(s.id);
    await m.etat(ref(s));
    const lier = await m.get(`/discord/lier/${ref(s)}`);
    const state = new URL(lier.headers.get('location')).searchParams.get('state');
    const cb = await m.get(`/discord/callback?code=abc&state=${encodeURIComponent(state)}`);
    assert.strictEqual(cb.headers.get('location'), `/acces/${ref(s)}`);
    assert.match(cb.headers.get('set-cookie'), /ovx_session=/);
    assert.strictEqual(m.db.prepare('SELECT discord_id d FROM membres').get().d, '400000000000000001');
    assert.deepStrictEqual(m.oauth.ajouts, [['400000000000000001', [m.config.offres.community.roleDiscord]]]);
    assert.match(await (await m.get(`/acces/${ref(s)}`)).text(), /Discord connecté/);
    // state falsifié refusé
    assert.strictEqual((await m.get('/discord/callback?code=abc&state=faux.faux')).status, 400);
  } finally { await m.fermer(); }
});

test('candidature Tally : signature vérifiée, transmise à Bob', async () => {
  const recues = [];
  const m = await monter({ bob: { candidature: async (c) => recues.push(c) } });
  try {
    const corps = JSON.stringify({ data: { fields: [
      { label: 'Prénom', value: 'Awa' },
      { label: 'Objectif', value: ['o1'], options: [{ id: 'o1', text: 'Monétiser' }] },
    ] } });
    const sig = crypto.createHmac('sha256', 'tallysecret').update(corps).digest('base64');
    assert.strictEqual((await fetch(`${m.base}/webhooks/tally`, { method: 'POST', headers: { 'tally-signature': sig }, body: corps })).status, 200);
    assert.deepStrictEqual(recues[0], [{ label: 'Prénom', valeur: 'Awa' }, { label: 'Objectif', valeur: 'Monétiser' }]);
    assert.strictEqual((await fetch(`${m.base}/webhooks/tally`, { method: 'POST', headers: { 'tally-signature': 'x' }, body: corps })).status, 401);
  } finally { await m.fermer(); }
});

test('client SasPay : retrouve la session par transaction (pages)', async () => {
  const fakeFetch = async (url) => {
    const page = new URL(url).searchParams.get('page');
    const results = page === '1' ? [{ id: 'a', transaction: 'tx-a' }] : [{ id: 'b', transaction: { id: 'tx-b' } }];
    return new Response(JSON.stringify({ count: 2, next: page === '1' ? 'p2' : null, results }), { status: 200 });
  };
  const sp = creerClientSaspay({ apiUrl: 'https://s/api/v1', cleApi: 'k', pagesRecherche: 5 }, fakeFetch);
  assert.strictEqual((await sp.trouverSessionParTransaction('tx-b')).id, 'b');
  assert.strictEqual(await sp.trouverSessionParTransaction('tx-z'), null);
});
