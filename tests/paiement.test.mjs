import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { creerPaiement, statutPaiement, webhookSaspay } from "../netlify/lib/paiement.mjs";
import { stockageLocal } from "./aide-blobs.mjs";

const nouveauStore = stockageLocal();

const env = {
  URL: "https://creatoskills.site",
  SASPAY_API_KEY: "sk_test",
  SASPAY_WEBHOOK_SECRET: "secret",
  ACCESS_CODE: "CODE-TEST",
  COMMUNITY_URL: "https://whop.test/acces",
  DISCORD_WEBHOOK_URL: "https://discord.test/webhook",
};

// Faux SasPay (et faux Discord) : répond selon la route, garde la trace des appels.
function fauxSaspay({ statut = "SUCCESS", verification = "SUCCESS" } = {}) {
  const appels = [];
  const fetcher = async (url, init = {}) => {
    const corps = init.body ? JSON.parse(init.body) : null;
    appels.push({ url, methode: init.method, auth: init.headers?.Authorization, corps });
    if (url === env.DISCORD_WEBHOOK_URL) return new Response(null, { status: 204 });
    if (url.endsWith("/checkout-sessions/")) return Response.json({ success: true, data: { id: "cs_1", checkout_url: "https://pay.saspay.test/cs_1" } });
    if (url.endsWith("/checkout-sessions/cs_1/status/")) return Response.json({ success: true, data: { transaction_status: statut, transaction_id: statut === "SUCCESS" ? "tx_1" : null } });
    if (url.endsWith("/payments/tx_1/verify/")) return Response.json({ success: true, data: { status: verification, net_amount: "114.00", currency: "EUR" } });
    return new Response(null, { status: 404 });
  };
  return { appels, fetcher };
}

const checkout = (corps) => new Request("https://creatoskills.site/api/checkout", { method: "POST", body: JSON.stringify(corps) });
const statut = (token) => new Request(`https://creatoskills.site/api/status?s=${token}`);

async function payer(store, saspay) {
  const res = await creerPaiement(checkout({ name: " Jean  Dupont ", email: "Jean@Exemple.com" }), store, { env, fetcher: saspay.fetcher, ip: "1.2.3.4" });
  assert.equal(res.status, 200);
  assert.equal((await res.json()).url, "https://pay.saspay.test/cs_1");
  const demande = saspay.appels.find((a) => a.url.endsWith("/checkout-sessions/"));
  assert.equal(demande.auth, "Bearer sk_test");
  assert.equal(demande.corps.amount, "120.00");
  assert.equal(demande.corps.customer_name, "Jean Dupont");
  assert.equal(demande.corps.customer_email, "jean@exemple.com");
  const token = demande.corps.metadata.token;
  assert.equal(demande.corps.return_url, `https://creatoskills.site/paiement/merci.html?s=${token}`);
  return token;
}

test("paiement réussi : code d'accès donné, un seul message Discord", async () => {
  const store = nouveauStore();
  const saspay = fauxSaspay();
  const token = await payer(store, saspay);
  const r1 = await (await statutPaiement(statut(token), store, { env, fetcher: saspay.fetcher })).json();
  assert.deepEqual(r1, { status: "SUCCESS", code: "CODE-TEST", community: "https://whop.test/acces" });
  // Une seconde vérification ne rappelle pas SasPay et ne renvoie pas de message.
  const avant = saspay.appels.length;
  assert.equal((await (await statutPaiement(statut(token), store, { env, fetcher: saspay.fetcher })).json()).status, "SUCCESS");
  assert.equal(saspay.appels.length, avant);
  const discord = saspay.appels.filter((a) => a.url === env.DISCORD_WEBHOOK_URL);
  assert.equal(discord.length, 1);
  assert.match(discord[0].corps.content, /Nouveau paiement TikTok Elite[\s\S]*Jean Dupont[\s\S]*jean@exemple\.com[\s\S]*114\.00 EUR/);
});

test("pas de code si la transaction n'est pas confirmée", async () => {
  for (const [cas, attendu] of [[{ statut: "PENDING" }, "PENDING"], [{ statut: "FAILED" }, "FAILED"], [{ verification: "FAILED" }, "PENDING"]]) {
    const store = nouveauStore();
    const saspay = fauxSaspay(cas);
    const token = await payer(store, saspay);
    const r = await (await statutPaiement(statut(token), store, { env, fetcher: saspay.fetcher })).json();
    assert.deepEqual(r, { status: attendu });
  }
});

test("lien de retour inconnu ou mal formé", async () => {
  const store = nouveauStore();
  assert.equal((await statutPaiement(statut("pas-un-jeton"), store, { env })).status, 404);
  assert.equal((await statutPaiement(statut("00000000-0000-0000-0000-000000000000"), store, { env })).status, 404);
});

test("paiement fermé tant que les réglages manquent ; formulaire vérifié ; limite anti-abus", async () => {
  const store = nouveauStore();
  const saspay = fauxSaspay();
  assert.equal((await creerPaiement(checkout({ name: "Jean", email: "j@ex.com" }), store, { env: { ...env, ACCESS_CODE: "" }, fetcher: saspay.fetcher })).status, 503);
  assert.equal((await creerPaiement(checkout({ name: "J", email: "j@ex.com" }), store, { env, fetcher: saspay.fetcher, ip: "5.5.5.5" })).status, 400);
  assert.equal((await creerPaiement(checkout({ name: "Jean", email: "pas-un-mail" }), store, { env, fetcher: saspay.fetcher, ip: "5.5.5.5" })).status, 400);
  const statuts = [];
  for (let i = 0; i < 7; i++) statuts.push((await creerPaiement(checkout({ name: "Jean", email: "j@ex.com" }), store, { env, fetcher: saspay.fetcher, ip: "5.5.5.5" })).status);
  assert.deepEqual(statuts, [200, 200, 200, 200, 200, 200, 429]);
});

test("webhook : seule une signature valide et récente est acceptée", async () => {
  const store = nouveauStore();
  const now = Date.UTC(2026, 9, 12, 10);
  const ts = String(Math.floor(now / 1000));
  const corps = JSON.stringify({ event: "transaction.success", data: { id: "tx_1", status: "SUCCESS", net_amount: "114.00", currency: "EUR" } });
  const signe = (secret, t = ts) => createHmac("sha256", secret).update(`${t}.${corps}`).digest("hex");
  const req = (sig, t = ts) => new Request("https://creatoskills.site/api/saspay/webhook", { method: "POST", body: corps, headers: { "x-webhook-signature": sig, "x-webhook-timestamp": t } });

  assert.equal((await webhookSaspay(req(signe("secret")), store, { env, now })).status, 200);
  assert.equal((await webhookSaspay(req(signe("autre")), store, { env, now })).status, 403);
  const vieux = String(Number(ts) - 600);
  assert.equal((await webhookSaspay(req(signe("secret", vieux), vieux), store, { env, now })).status, 403);
  const { blobs } = await store.list({ prefix: "webhooks/" });
  assert.equal(blobs.length, 1);
  assert.deepEqual(await store.get(blobs[0].key, { type: "json" }), { event: "transaction.success", id: "tx_1", status: "SUCCESS", net_amount: "114.00", currency: "EUR" });
});
