'use strict';

const test = require('node:test');
const assert = require('node:assert');
const crypto = require('crypto');
const { creerApp, jetonMembre, lireJetonMembre } = require('../src/app');
const { ouvrirBase } = require('../src/db');
const { creerCommandes } = require('../src/commandes');
const { signatureValide, creerClientSaspay } = require('../src/saspay');
const { creerClientWhop } = require('../src/whop');
const { codePourRef } = require('../src/acces');

const SECRET_WEBHOOK = 'whsec_test';
const config = {
  baseUrl: 'http://localhost',
  nomFormation: 'Formation Test',
  devise: 'XOF',
  prixInscription: '19025',
  prixMensuel: '3280',
  dureeAccesJours: 30,
  lienDiscord: 'https://discord.gg/test',
  contactSupport: 'support@test',
  secretApp: 'x'.repeat(40),
  saspay: { secretWebhook: SECRET_WEBHOOK },
  whop: {},
  email: {},
};

function signer(corps, ts = Math.floor(Date.now() / 1000)) {
  const sig = crypto.createHmac('sha256', SECRET_WEBHOOK).update(`${ts}.${corps}`).digest('hex');
  return { 'X-Webhook-Signature': sig, 'X-Webhook-Timestamp': String(ts) };
}

// Faux SasPay / Whop en mémoire.
function monter({ montantPaye, devise = 'XOF', statutTx = 'SUCCESS' } = {}) {
  const sessions = new Map();
  const codes = new Map();
  const emails = [];
  const saspay = {
    async creerSessionCheckout(c) {
      const s = { id: crypto.randomUUID(), checkout_url: `https://sandbox-checkout.saspay.me/${sessions.size}`, status: 'PENDING', transaction: null, ...c };
      sessions.set(s.id, s);
      return s;
    },
    payer(id, statut = 'PAID') { const s = sessions.get(id); s.status = statut; s.transaction = 'tx-' + id; return s.transaction; },
    async statutSession(id) {
      const s = sessions.get(id);
      return { id, status: s.status, transaction_id: s.transaction, transaction_status: s.transaction ? statutTx : null };
    },
    async verifierPaiement(txId) {
      const s = [...sessions.values()].find((x) => x.transaction === txId);
      return { id: txId, status: statutTx, currency: devise, requested_amount: montantPaye || s.amount };
    },
    async trouverSessionParTransaction(txId) { return [...sessions.values()].find((s) => s.transaction === txId) || null; },
  };
  const whop = {
    async assurerCodePromo(code) { const nouveau = !codes.has(code); codes.set(code, true); return { code, nouveau }; },
    async lienAchatOffre() { return 'https://whop.com/checkout/plan_test'; },
  };
  const db = ouvrirBase(':memory:');
  const commandes = creerCommandes({ db, saspay, whop, config, envoyerEmail: async (e) => { emails.push(e); } });
  const app = creerApp({ config, commandes, whop });
  return { app, db, saspay, sessions, codes, emails };
}

async function demarrer(m) {
  const serveur = await new Promise((r) => { const s = m.app.listen(0, () => r(s)); });
  m.base = `http://127.0.0.1:${serveur.address().port}`;
  m.fermer = () => new Promise((r) => serveur.close(r));
  return m;
}

function poster(base, chemin, champs) {
  return fetch(base + chemin, {
    method: 'POST', redirect: 'manual',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(champs),
  });
}

function derniereSession(m) { return [...m.sessions.values()].at(-1); }
function refDe(session) { return session.metadata.ref; }
const etat = async (m, ref) => (await fetch(`${m.base}/api/commandes/${ref}`)).json();

test('signature webhook : valide, falsifiée, trop vieille', () => {
  const corps = '{"event":"transaction.success"}';
  const h = signer(corps);
  assert.ok(signatureValide(Buffer.from(corps), h['X-Webhook-Signature'], h['X-Webhook-Timestamp'], SECRET_WEBHOOK));
  assert.ok(!signatureValide(Buffer.from(corps + ' '), h['X-Webhook-Signature'], h['X-Webhook-Timestamp'], SECRET_WEBHOOK));
  const vieux = signer(corps, Math.floor(Date.now() / 1000) - 600);
  assert.ok(!signatureValide(Buffer.from(corps), vieux['X-Webhook-Signature'], vieux['X-Webhook-Timestamp'], SECRET_WEBHOOK));
  assert.ok(!signatureValide(Buffer.from(corps), undefined, undefined, SECRET_WEBHOOK));
});

test('code promo déterministe et jeton membre infalsifiable', () => {
  assert.strictEqual(codePourRef('r1', config.secretApp), codePourRef('r1', config.secretApp));
  assert.notStrictEqual(codePourRef('r1', config.secretApp), codePourRef('r2', config.secretApp));
  assert.match(codePourRef('r1', config.secretApp), /^ACCES[A-Z2-9]{10}$/);
  const j = jetonMembre('awa@example.com', config.secretApp);
  assert.strictEqual(lireJetonMembre(j, config.secretApp), 'awa@example.com');
  const faux = Buffer.from('autre@example.com').toString('base64url') + '.' + j.split('.')[1];
  assert.strictEqual(lireJetonMembre(faux, config.secretApp), null);
});

test('inscription : accueil → formulaire → SasPay → chargement → tutoriel', async () => {
  const m = await demarrer(monter());
  try {
    assert.match(await (await fetch(m.base + '/')).text(), /Payer par mobile money/);
    const res = await poster(m.base, '/paiement', { nom: 'Awa Sossou', email: 'Awa@Example.com', telephone: '+229 01 97' });
    assert.strictEqual(res.status, 303);
    const s = derniereSession(m);
    assert.strictEqual(res.headers.get('location'), s.checkout_url);
    assert.strictEqual(s.amount, '19025.00');
    assert.strictEqual(s.customer_email, 'awa@example.com');
    const ref = refDe(s);
    assert.strictEqual(s.return_url, `http://localhost/confirmation/${ref}`);

    // Page de chargement, paiement pas encore fait.
    assert.match(await (await fetch(`${m.base}/confirmation/${ref}`)).text(), /Vérification du paiement/);
    assert.deepStrictEqual(await etat(m, ref), { etat: 'en_attente', reessayable: false });
    assert.strictEqual((await fetch(`${m.base}/acces/${ref}`, { redirect: 'manual' })).status, 303);

    m.saspay.payer(s.id);
    const e = await etat(m, ref);
    assert.strictEqual(e.etat, 'confirme');
    assert.strictEqual(e.redirection, `/acces/${ref}`);

    const code = codePourRef(ref, config.secretApp);
    const tuto = await (await fetch(`${m.base}${e.redirection}`)).text();
    assert.match(tuto, new RegExp(code));
    assert.match(tuto, /whop\.com\/checkout\/plan_test/);
    assert.match(tuto, /Connecter Discord/);

    const membre = m.db.prepare('SELECT * FROM membres').get();
    assert.strictEqual(membre.email, 'awa@example.com');
    assert.strictEqual(membre.code_promo, code);
    const jours = (new Date(membre.acces_jusqu_au) - Date.now()) / 86400000;
    assert.ok(jours > 29.9 && jours <= 30, `durée ${jours}`);
    assert.strictEqual(m.emails.length, 1);

    // Rechargements et webhook : aucun doublon (code, email, prolongation).
    await etat(m, ref);
    const corps = JSON.stringify({ event: 'transaction.success', data: { id: s.transaction, type: 'PAIEMENT' } });
    const wh = await fetch(`${m.base}/webhooks/saspay`, { method: 'POST', headers: signer(corps), body: corps });
    assert.strictEqual(wh.status, 200);
    assert.strictEqual(m.codes.size, 1);
    assert.strictEqual(m.emails.length, 1);
    assert.strictEqual(m.db.prepare('SELECT acces_jusqu_au a FROM membres').get().a, membre.acces_jusqu_au);

    // Réinscription avec le même email : refusée, renvoi vers le renouvellement.
    const re = await poster(m.base, '/paiement', { nom: 'Awa', email: 'awa@example.com' });
    assert.strictEqual(re.status, 409);
    assert.match(await re.text(), /renouveler\?m=/);
  } finally { await m.fermer(); }
});

test('webhook seul (client qui a fermé la page) : accès créé', async () => {
  const m = await demarrer(monter());
  try {
    await poster(m.base, '/paiement', { nom: 'Koffi', email: 'koffi@example.com' });
    const s = derniereSession(m);
    m.saspay.payer(s.id);
    const corps = JSON.stringify({ event: 'transaction.success', data: { id: s.transaction, type: 'PAIEMENT' } });
    const wh = await fetch(`${m.base}/webhooks/saspay`, { method: 'POST', headers: signer(corps), body: corps });
    assert.strictEqual(wh.status, 200);
    assert.strictEqual(m.codes.size, 1);
    assert.strictEqual(m.emails.length, 1);
    assert.ok(m.db.prepare('SELECT 1 FROM membres WHERE email = ?').get('koffi@example.com'));
  } finally { await m.fermer(); }
});

test('renouvellement : lien du bot → paiement → +30 jours sur la date existante', async () => {
  const m = await demarrer(monter());
  try {
    await poster(m.base, '/paiement', { nom: 'Awa Sossou', email: 'awa@example.com' });
    m.saspay.payer(derniereSession(m).id);
    await etat(m, refDe(derniereSession(m)));
    const avant = new Date(m.db.prepare('SELECT acces_jusqu_au a FROM membres').get().a);

    const jeton = jetonMembre('awa@example.com', config.secretApp);
    const page = await (await fetch(`${m.base}/renouveler?m=${jeton}`)).text();
    assert.match(page, /value="awa@example.com" readonly/);

    // Même si quelqu'un modifie le champ email, c'est l'email du jeton qui compte.
    const res = await poster(m.base, '/renouveler', { nom: 'Awa Sossou', email: 'pirate@example.com', m: jeton });
    assert.strictEqual(res.status, 303);
    const s = derniereSession(m);
    assert.strictEqual(s.amount, '3280.00');
    assert.strictEqual(s.customer_email, 'awa@example.com');

    m.saspay.payer(s.id);
    const e = await etat(m, refDe(s));
    assert.strictEqual(e.redirection, `/renouvele/${refDe(s)}`);
    const fin = await (await fetch(m.base + e.redirection)).text();
    assert.match(fin, /Abonnement renouvelé/);
    assert.match(fin, /discord\.gg\/test/);

    const apres = new Date(m.db.prepare('SELECT acces_jusqu_au a FROM membres').get().a);
    assert.strictEqual(apres - avant, 30 * 86400000);
    assert.strictEqual(m.codes.size, 1, 'pas de nouveau code Whop pour un renouvellement');
  } finally { await m.fermer(); }
});

test('renouvellement refusé pour un email inconnu', async () => {
  const m = await demarrer(monter());
  try {
    const res = await poster(m.base, '/renouveler', { nom: 'Inconnu', email: 'inconnu@example.com' });
    assert.strictEqual(res.status, 404);
    assert.strictEqual(m.sessions.size, 0);
  } finally { await m.fermer(); }
});

test('paiement non conforme ou échoué : « non confirmé », aucun accès', async () => {
  const cas = [
    [{ montantPaye: '100.00' }, 'PAID', false],
    [{ devise: 'XAF' }, 'PAID', false],
    [{ statutTx: 'FAILED' }, 'PENDING', true],
    [{}, 'EXPIRED', false],
  ];
  for (const [opts, statutSession, reessayable] of cas) {
    const m = await demarrer(monter(opts));
    try {
      await poster(m.base, '/paiement', { nom: 'Awa', email: 'awa@example.com' });
      const s = derniereSession(m);
      m.saspay.payer(s.id, statutSession);
      const e = await etat(m, refDe(s));
      assert.strictEqual(e.etat, 'echec', JSON.stringify(opts));
      assert.strictEqual(e.reessayable, reessayable);
      assert.strictEqual(m.codes.size, 0);
      assert.strictEqual(m.db.prepare('SELECT COUNT(*) n FROM membres').get().n, 0);
    } finally { await m.fermer(); }
  }
});

test('sécurité : webhook non signé refusé, ref inconnue introuvable, email invalide refusé', async () => {
  const m = await demarrer(monter());
  try {
    const corps = JSON.stringify({ event: 'transaction.success', data: { id: 'x' } });
    const wh = await fetch(`${m.base}/webhooks/saspay`, { method: 'POST', headers: { 'X-Webhook-Signature': 'abc', 'X-Webhook-Timestamp': String(Math.floor(Date.now() / 1000)) }, body: corps });
    assert.strictEqual(wh.status, 401);
    assert.deepStrictEqual(await etat(m, 'AAAAAAAAAAAAAAAAAAAAAA'), { etat: 'introuvable', reessayable: false });
    assert.strictEqual((await fetch(`${m.base}/acces/<script>`)).status, 404);
    const res = await poster(m.base, '/paiement', { nom: 'Awa', email: 'pas-un-email' });
    assert.strictEqual(res.status, 400);
    assert.strictEqual(m.sessions.size, 0);
  } finally { await m.fermer(); }
});

test('client Whop : 409 → récupère le code existant', async () => {
  const appels = [];
  const fakeFetch = async (url, init) => {
    appels.push({ url, init });
    if (init.method === 'POST') return new Response('{"error":"exists"}', { status: 409 });
    return new Response(JSON.stringify({ data: [{ id: 'promo_1', code: 'ACCESABC' }], page_info: { has_next_page: false } }), { status: 200 });
  };
  const whop = creerClientWhop({ apiUrl: 'https://w/api/v1', cleApi: 'k', versionApi: '2026-07-01', idEntreprise: 'biz_1', idOffre: 'plan_1', deviseOffre: 'eur' }, fakeFetch);
  assert.deepStrictEqual(await whop.assurerCodePromo('ACCESABC'), { code: 'ACCESABC', id: 'promo_1', nouveau: false });
  const post = JSON.parse(appels[0].init.body);
  assert.strictEqual(post.amount_off, 100);
  assert.strictEqual(post.stock, 1);
  assert.deepStrictEqual(post.variant_ids, ['plan_1']);
  assert.strictEqual(appels[0].init.headers['Api-Version-Date'], '2026-07-01');
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
