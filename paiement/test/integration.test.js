'use strict';

const test = require('node:test');
const assert = require('node:assert');
const crypto = require('crypto');
const { creerApp } = require('../src/app');
const { signatureValide, creerClientSaspay } = require('../src/saspay');
const { creerClientWhop } = require('../src/whop');
const { codePourSession } = require('../src/acces');

const SECRET_WEBHOOK = 'whsec_test';
const config = {
  port: 0,
  baseUrl: 'http://localhost',
  nomFormation: 'Formation Test',
  prix: '25000',
  devise: 'XOF',
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
function faux({ montantPaye = '25000.00', devise = 'XOF', statut = 'SUCCESS' } = {}) {
  const sessions = new Map();
  const codes = new Map();
  const emails = [];
  const saspay = {
    async creerSessionCheckout(c) {
      const s = { id: crypto.randomUUID(), checkout_url: 'https://sandbox-checkout.saspay.me/x', status: 'PENDING', transaction: null, ...c };
      sessions.set(s.id, s);
      return s;
    },
    payer(id) { const s = sessions.get(id); s.status = 'PAID'; s.transaction = 'tx-' + id; return s.transaction; },
    async statutSession(id) {
      const s = sessions.get(id);
      return { id, status: s.status, transaction_id: s.transaction, transaction_status: s.transaction ? statut : null };
    },
    async detailSession(id) { return sessions.get(id); },
    async verifierPaiement(txId) { return { id: txId, status: statut, currency: devise, requested_amount: montantPaye }; },
    async trouverSessionParTransaction(txId) { return [...sessions.values()].find((s) => s.transaction === txId) || null; },
  };
  const whop = {
    async assurerCodePromo(code) { const nouveau = !codes.has(code); codes.set(code, true); return { code, nouveau }; },
    async lienAchatOffre() { return 'https://whop.com/checkout/plan_test'; },
  };
  const envoyerEmail = async (e) => { emails.push(e); };
  return { saspay, whop, envoyerEmail, sessions, codes, emails };
}

async function demarrer(deps) {
  const app = creerApp({ config, ...deps });
  const serveur = await new Promise((r) => { const s = app.listen(0, () => r(s)); });
  const base = `http://127.0.0.1:${serveur.address().port}`;
  return { base, fermer: () => new Promise((r) => serveur.close(r)) };
}

async function acheter(base) {
  const res = await fetch(`${base}/acheter`, {
    method: 'POST',
    redirect: 'manual',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ nom: 'Awa Sossou', email: 'Awa@Example.com', telephone: '+229 01 97' }),
  });
  return { res, cookie: res.headers.get('set-cookie').split(';')[0] };
}

test('signature webhook : valide, falsifiée, trop vieille', () => {
  const corps = '{"event":"transaction.success"}';
  const h = signer(corps);
  assert.ok(signatureValide(Buffer.from(corps), h['X-Webhook-Signature'], h['X-Webhook-Timestamp'], SECRET_WEBHOOK));
  assert.ok(!signatureValide(Buffer.from(corps + ' '), h['X-Webhook-Signature'], h['X-Webhook-Timestamp'], SECRET_WEBHOOK));
  const vieux = signer(corps, Math.floor(Date.now() / 1000) - 600);
  assert.ok(!signatureValide(Buffer.from(corps), vieux['X-Webhook-Signature'], vieux['X-Webhook-Timestamp'], SECRET_WEBHOOK));
  assert.ok(!signatureValide(Buffer.from(corps), undefined, undefined, SECRET_WEBHOOK));
});

test('code promo déterministe et propre à chaque session', () => {
  const a = codePourSession('s1', config.secretApp);
  assert.strictEqual(a, codePourSession('s1', config.secretApp));
  assert.notStrictEqual(a, codePourSession('s2', config.secretApp));
  assert.match(a, /^ACCES[A-Z2-9]{10}$/);
});

test('parcours complet : achat → paiement → webhook → page merci', async () => {
  const f = faux();
  const { base, fermer } = await demarrer(f);
  try {
    const { res, cookie } = await acheter(base);
    assert.strictEqual(res.status, 303);
    assert.strictEqual(res.headers.get('location'), 'https://sandbox-checkout.saspay.me/x');
    const session = [...f.sessions.values()][0];
    assert.strictEqual(session.amount, '25000.00');
    assert.strictEqual(session.customer_email, 'awa@example.com');
    assert.strictEqual(session.return_url, 'http://localhost/merci');

    // Avant paiement : page d'attente.
    let merci = await fetch(`${base}/merci`, { headers: { cookie } });
    assert.match(await merci.text(), /en cours de confirmation/);

    const txId = f.saspay.payer(session.id);
    const corps = JSON.stringify({ event: 'transaction.success', data: { id: txId, type: 'PAIEMENT', status: 'SUCCESS' } });
    const wh = await fetch(`${base}/webhooks/saspay`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...signer(corps) }, body: corps });
    assert.strictEqual(wh.status, 200);
    const code = codePourSession(session.id, config.secretApp);
    assert.ok(f.codes.has(code));
    assert.strictEqual(f.emails.length, 1);
    assert.strictEqual(f.emails[0].code, code);

    // Rejeu du webhook : même code, pas de doublon.
    const wh2 = await fetch(`${base}/webhooks/saspay`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...signer(corps) }, body: corps });
    assert.strictEqual(wh2.status, 200);
    assert.strictEqual(f.codes.size, 1);

    merci = await fetch(`${base}/merci`, { headers: { cookie } });
    const html = await merci.text();
    assert.match(html, new RegExp(code));
    assert.match(html, /whop\.com\/checkout\/plan_test/);
  } finally { await fermer(); }
});

test('webhook à signature invalide : refusé, aucun code', async () => {
  const f = faux();
  const { base, fermer } = await demarrer(f);
  try {
    const corps = JSON.stringify({ event: 'transaction.success', data: { id: 'x' } });
    const res = await fetch(`${base}/webhooks/saspay`, { method: 'POST', headers: { 'X-Webhook-Signature': 'abc', 'X-Webhook-Timestamp': String(Math.floor(Date.now() / 1000)) }, body: corps });
    assert.strictEqual(res.status, 401);
    assert.strictEqual(f.codes.size, 0);
  } finally { await fermer(); }
});

test('montant insuffisant ou mauvaise devise : pas d\'accès', async () => {
  for (const opts of [{ montantPaye: '100.00' }, { devise: 'XAF' }, { statut: 'FAILED' }]) {
    const f = faux(opts);
    const { base, fermer } = await demarrer(f);
    try {
      await acheter(base);
      const session = [...f.sessions.values()][0];
      const txId = f.saspay.payer(session.id);
      const corps = JSON.stringify({ event: 'transaction.success', data: { id: txId, type: 'PAIEMENT' } });
      const res = await fetch(`${base}/webhooks/saspay`, { method: 'POST', headers: signer(corps), body: corps });
      assert.strictEqual(res.status, 200);
      assert.strictEqual(f.codes.size, 0, JSON.stringify(opts));
      assert.strictEqual(f.emails.length, 0);
    } finally { await fermer(); }
  }
});

test('cookie falsifié : aucune info de paiement révélée', async () => {
  const f = faux();
  const { base, fermer } = await demarrer(f);
  try {
    const res = await fetch(`${base}/merci`, { headers: { cookie: 'sp_session=autre-id.faux' } });
    const html = await res.text();
    assert.doesNotMatch(html, /ACCES/);
  } finally { await fermer(); }
});

test('formulaire : email invalide refusé', async () => {
  const f = faux();
  const { base, fermer } = await demarrer(f);
  try {
    const res = await fetch(`${base}/acheter`, { method: 'POST', redirect: 'manual', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'nom=Awa&email=pas-un-email' });
    assert.strictEqual(res.status, 400);
    assert.strictEqual(f.sessions.size, 0);
  } finally { await fermer(); }
});

test('client Whop : 409 → récupère le code existant', async () => {
  const appels = [];
  const fakeFetch = async (url, init) => {
    appels.push({ url, init });
    if (init.method === 'POST') return new Response('{"error":"exists"}', { status: 409 });
    return new Response(JSON.stringify({ data: [{ id: 'promo_1', code: 'ACCESABC' }], page_info: { has_next_page: false } }), { status: 200 });
  };
  const whop = creerClientWhop({ apiUrl: 'https://w/api/v1', cleApi: 'k', versionApi: '2026-07-01', idEntreprise: 'biz_1', idOffre: 'plan_1', deviseOffre: 'usd' }, fakeFetch);
  const r = await whop.assurerCodePromo('ACCESABC');
  assert.deepStrictEqual(r, { code: 'ACCESABC', id: 'promo_1', nouveau: false });
  const post = JSON.parse(appels[0].init.body);
  assert.strictEqual(post.amount_off, 100);
  assert.strictEqual(post.stock, 1);
  assert.deepStrictEqual(post.variant_ids, ['plan_1']);
  assert.strictEqual(appels[0].init.headers['Api-Version-Date'], '2026-07-01');
});

test('client SasPay : retrouve la session par transaction (pages)', async () => {
  const fakeFetch = async (url) => {
    const page = new URL(url).searchParams.get('page');
    const results = page === '1'
      ? [{ id: 'a', transaction: 'tx-a' }]
      : [{ id: 'b', transaction: { id: 'tx-b' } }];
    return new Response(JSON.stringify({ count: 2, next: page === '1' ? 'p2' : null, results }), { status: 200 });
  };
  const sp = creerClientSaspay({ apiUrl: 'https://s/api/v1', cleApi: 'k', pagesRecherche: 5 }, fakeFetch);
  assert.strictEqual((await sp.trouverSessionParTransaction('tx-b')).id, 'b');
  assert.strictEqual(await sp.trouverSessionParTransaction('tx-z'), null);
});
