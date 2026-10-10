import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { creerPaiement, statutPaiement, webhookSaspay } from "../lib/paiement.mjs";
import { stockageLocal } from "./aide-stockage.mjs";

const nouveauStore = stockageLocal();

const env = {
  SASPAY_API_KEY: "sk_test",
  SASPAY_WEBHOOK_SECRET: "secret",
  MAKETOU_API_KEY: "mk_test",
  MAKETOU_PRODUCT_ID: "7b63442b-200f-445c-89c6-cd4b3b001bf7",
  ACCESS_CODE: "CODE-TEST",
  COMMUNITY_URL: "https://whop.test/acces",
};
const CART = "fd2d91d7-20d2-4b86-b067-d474fb0d1e60";

// Faux SasPay, faux Maketou (réponses de la documentation) et faux Discord.
function fauxServices({ saspay = "SUCCESS", verification = "SUCCESS", panier = "completed", jetonPanier, discord = 200 } = {}) {
  const appels = [];
  let meta = null;
  const fetcher = async (url, init = {}) => {
    const corps = init.body ? JSON.parse(init.body) : null;
    appels.push({ url, methode: init.method, auth: init.headers?.Authorization, corps });
    // Discord (message privé du bot)
    if (url === "https://discord.com/api/v10/users/@me/channels") return discord === 200 ? Response.json({ id: "dm-1" }) : new Response(null, { status: discord });
    if (url === "https://discord.com/api/v10/channels/dm-1/messages") return new Response(null, { status: 200 });
    // SasPay
    if (url.endsWith("/checkout-sessions/")) return Response.json({ success: true, data: { id: "cs_1", checkout_url: "https://pay.saspay.test/cs_1" } });
    if (url.endsWith("/checkout-sessions/cs_1/status/")) return Response.json({ success: true, data: { transaction_status: saspay, transaction_id: saspay === "SUCCESS" ? "tx_1" : null } });
    if (url.endsWith("/payments/tx_1/verify/")) return Response.json({ success: true, data: { status: verification, net_amount: "114.00", currency: "EUR" } });
    // Maketou
    if (url === "https://api.maketou.net/api/v1/stores/cart/checkout") {
      meta = corps.meta;
      return Response.json({ cart: { id: CART, status: "waiting_payment", customerInfo: {} }, redirectUrl: "https://checkout.moneroo.io/py_test" }, { status: 201 });
    }
    if (url === `https://api.maketou.net/api/v1/stores/cart/${CART}`) {
      return Response.json({ id: CART, paymentId: "4d729bf5-ef1e-4f7f-bf10-e63bd3db9b04", status: panier, customerInfo: {}, meta: jetonPanier ? { token: jetonPanier } : meta });
    }
    return new Response(null, { status: 404 });
  };
  return { appels, fetcher };
}

const checkout = (corps) => new Request("https://creatoskills.site/api/checkout", { method: "POST", body: JSON.stringify(corps) });
const statut = (token) => new Request(`https://creatoskills.site/api/status?s=${token}`);
const client = { firstName: " Jean ", lastName: " Dupont ", email: "Jean@Exemple.com" };

async function payer(store, services, moyen) {
  const res = await creerPaiement(checkout({ moyen, ...client }), store, { env, fetcher: services.fetcher, ip: "1.2.3.4" });
  assert.equal(res.status, 200);
  return (await res.json()).url;
}

test("mobile money (SasPay) : paiement créé, code d'accès donné après double vérification", async () => {
  const store = nouveauStore();
  const s = fauxServices();
  assert.equal(await payer(store, s, "mobile"), "https://pay.saspay.test/cs_1");
  const demande = s.appels.find((a) => a.url.endsWith("/checkout-sessions/"));
  assert.equal(demande.auth, "Bearer sk_test");
  assert.equal(demande.corps.amount, "115.00");
  assert.equal(demande.corps.customer_name, "Jean Dupont");
  assert.equal(demande.corps.customer_email, "jean@exemple.com");
  const token = demande.corps.metadata.token;
  assert.equal(demande.corps.return_url, `https://creatoskills.site/paiement/merci.html?s=${token}`);

  const r1 = await (await statutPaiement(statut(token), store, { env, fetcher: s.fetcher })).json();
  assert.deepEqual(r1, { status: "SUCCESS", code: "CODE-TEST", community: "https://whop.test/acces" });
  // Une seconde vérification ne rappelle pas SasPay et ne renvoie pas de message.
  const avant = s.appels.length;
  assert.equal((await (await statutPaiement(statut(token), store, { env, fetcher: s.fetcher })).json()).status, "SUCCESS");
  assert.equal(s.appels.length, avant);
});

test("carte (Maketou) : panier créé selon la documentation, code donné seulement si « completed »", async () => {
  const store = nouveauStore();
  const s = fauxServices();
  assert.equal(await payer(store, s, "carte"), "https://checkout.moneroo.io/py_test");
  const demande = s.appels.find((a) => a.url.endsWith("/stores/cart/checkout"));
  assert.equal(demande.methode, "POST");
  assert.equal(demande.auth, "Bearer mk_test");
  const token = demande.corps.meta.token;
  assert.deepEqual(demande.corps, {
    productDocumentId: env.MAKETOU_PRODUCT_ID,
    email: "jean@exemple.com",
    firstName: "Jean",
    lastName: "Dupont",
    redirectURL: `https://creatoskills.site/paiement/merci.html?s=${token}`,
    meta: { token },
  });
  // Aucun appel à SasPay pour un paiement par carte.
  assert.ok(!s.appels.some((a) => a.url.includes("saspay")));

  const r = await (await statutPaiement(statut(token), store, { env, fetcher: s.fetcher })).json();
  assert.deepEqual(r, { status: "SUCCESS", code: "CODE-TEST", community: "https://whop.test/acces" });
  const verif = s.appels.find((a) => a.methode === "GET");
  assert.equal(verif.url, `https://api.maketou.net/api/v1/stores/cart/${CART}`);
  assert.equal(verif.auth, "Bearer mk_test");
});

test("carte (Maketou) : pas de code tant que le panier n'est pas payé", async () => {
  for (const [panier, attendu] of [["waiting_payment", "PENDING"], ["payment_failed", "FAILED"], ["abandoned", "FAILED"]]) {
    const store = nouveauStore();
    const s = fauxServices({ panier });
    await payer(store, s, "carte");
    const token = s.appels.find((a) => a.url.endsWith("/stores/cart/checkout")).corps.meta.token;
    assert.deepEqual(await (await statutPaiement(statut(token), store, { env, fetcher: s.fetcher })).json(), { status: attendu });
  }
});

test("carte (Maketou) : un panier qui ne correspond pas au lien de retour est refusé", async () => {
  const store = nouveauStore();
  const s = fauxServices({ jetonPanier: "00000000-0000-0000-0000-000000000000" });
  await payer(store, s, "carte");
  const token = s.appels.find((a) => a.url.endsWith("/stores/cart/checkout")).corps.meta.token;
  assert.deepEqual(await (await statutPaiement(statut(token), store, { env, fetcher: s.fetcher })).json(), { status: "FAILED" });
});

test("mobile money (SasPay) : pas de code si la transaction n'est pas confirmée", async () => {
  for (const [cas, attendu] of [[{ saspay: "PENDING" }, "PENDING"], [{ saspay: "FAILED" }, "FAILED"], [{ verification: "FAILED" }, "PENDING"]]) {
    const store = nouveauStore();
    const s = fauxServices(cas);
    await payer(store, s, "mobile");
    const token = s.appels.find((a) => a.url.endsWith("/checkout-sessions/")).corps.metadata.token;
    assert.deepEqual(await (await statutPaiement(statut(token), store, { env, fetcher: s.fetcher })).json(), { status: attendu });
  }
});

test("carte (Maketou) : produit de la boutique Creato par défaut", async () => {
  const store = nouveauStore();
  const s = fauxServices();
  await creerPaiement(checkout({ moyen: "carte", ...client }), store, { env: { ...env, MAKETOU_PRODUCT_ID: undefined }, fetcher: s.fetcher, ip: "7.7.7.7" });
  assert.equal(s.appels.find((a) => a.url.endsWith("/stores/cart/checkout")).corps.productDocumentId, "1aee38b8-746a-47ba-a638-fdb0c99f589b");
});

test("lien de retour inconnu ou mal formé", async () => {
  const store = nouveauStore();
  assert.equal((await statutPaiement(statut("pas-un-jeton"), store, { env })).status, 404);
  assert.equal((await statutPaiement(statut("00000000-0000-0000-0000-000000000000"), store, { env })).status, 404);
});

test("chaque moyen reste fermé tant que ses réglages manquent", async () => {
  const store = nouveauStore();
  const s = fauxServices();
  const sansMaketou = { ...env, MAKETOU_API_KEY: "" };
  assert.equal((await creerPaiement(checkout({ moyen: "carte", ...client }), store, { env: sansMaketou, fetcher: s.fetcher, ip: "9.9.9.1" })).status, 503);
  assert.equal((await creerPaiement(checkout({ moyen: "mobile", ...client }), store, { env: sansMaketou, fetcher: s.fetcher, ip: "9.9.9.1" })).status, 200);
  const sansCode = { ...env, ACCESS_CODE: "" };
  assert.equal((await creerPaiement(checkout({ moyen: "mobile", ...client }), store, { env: sansCode, fetcher: s.fetcher, ip: "9.9.9.2" })).status, 503);
  assert.equal((await creerPaiement(checkout({ moyen: "carte", ...client }), store, { env: sansCode, fetcher: s.fetcher, ip: "9.9.9.2" })).status, 503);
});

test("formulaire vérifié et limite anti-abus", async () => {
  const store = nouveauStore();
  const s = fauxServices();
  const essai = (corps) => creerPaiement(checkout(corps), store, { env, fetcher: s.fetcher, ip: "5.5.5.5" }).then((r) => r.status);
  assert.equal(await essai({ ...client }), 400);
  assert.equal(await essai({ moyen: "carte", ...client, firstName: "" }), 400);
  assert.equal(await essai({ moyen: "carte", ...client, lastName: " " }), 400);
  assert.equal(await essai({ moyen: "carte", ...client, email: "pas-un-mail" }), 400);
  const statuts = [];
  for (let i = 0; i < 6; i++) statuts.push(await essai({ moyen: i % 2 ? "carte" : "mobile", ...client }));
  assert.deepEqual(statuts, [200, 200, 200, 200, 200, 429]);
});

test("webhook SasPay : seule une signature valide et récente est acceptée", async () => {
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

// ----- Message privé Discord à chaque vente -----
const envDiscord = { ...env, DISCORD_BOT_TOKEN: "jeton-bot", DISCORD_USER_ID: "4242" };
const messagesDiscord = (s) => s.appels.filter((a) => a.url.endsWith("/channels/dm-1/messages"));
async function payerEtVerifier(s, store, moyen, e = envDiscord) {
  await creerPaiement(checkout({ moyen, ...client }), store, { env: e, fetcher: s.fetcher, ip: "3.3.3.3" });
  const a = s.appels.find((x) => x.url.endsWith("/checkout-sessions/") || x.url.endsWith("/stores/cart/checkout"));
  const token = a.corps.metadata?.token ?? a.corps.meta.token;
  return { token, r: await (await statutPaiement(statut(token), store, { env: e, fetcher: s.fetcher })).json() };
}

test("Discord : vente par mobile money → embed « Maneyy! » avec nom, montant reçu, SasPay et la petite image", async () => {
  const store = nouveauStore();
  const s = fauxServices();
  const { token, r } = await payerEtVerifier(s, store, "mobile");
  assert.equal(r.status, "SUCCESS");
  const ouverture = s.appels.find((a) => a.url.endsWith("/users/@me/channels"));
  assert.equal(ouverture.auth, "Bot jeton-bot");
  assert.deepEqual(ouverture.corps, { recipient_id: "4242" });
  assert.equal(messagesDiscord(s).length, 1);
  const { embeds, allowed_mentions } = messagesDiscord(s)[0].corps;
  assert.deepEqual(allowed_mentions, { parse: [] });
  // Montant reçu : le net donné par SasPay (114,00 €).
  assert.deepEqual(embeds, [{
    description: "💸Maneyy! Jean Dupont a rejoint Creato!\n114,00 € par mobile money (SasPay)!",
    color: 0xf5b301,
    thumbnail: { url: "https://creatoskills.site/img/discord/argent.png" },
  }]);
  // Le client recharge la page : pas de second message.
  await statutPaiement(statut(token), store, { env: envDiscord, fetcher: s.fetcher });
  assert.equal(messagesDiscord(s).length, 1);
});

test("Discord : vente par carte → embed avec le prix Maketou et Maketou", async () => {
  const store = nouveauStore();
  const s = fauxServices();
  await payerEtVerifier(s, store, "carte");
  assert.equal(messagesDiscord(s).length, 1);
  const [embed] = messagesDiscord(s)[0].corps.embeds;
  assert.equal(embed.description, "💸Maneyy! Jean Dupont a rejoint Creato!\n75 435 FCFA par carte (Maketou)!");
});

test("Discord : aucun message tant que le paiement n'est pas confirmé, ni sans réglages", async () => {
  const s1 = fauxServices({ panier: "waiting_payment" });
  await payerEtVerifier(s1, nouveauStore(), "carte");
  assert.equal(s1.appels.filter((a) => a.url.includes("discord.com")).length, 0);
  const s2 = fauxServices();
  const { r } = await payerEtVerifier(s2, nouveauStore(), "mobile", env);
  assert.equal(r.status, "SUCCESS");
  assert.equal(s2.appels.filter((a) => a.url.includes("discord.com")).length, 0);
});

test("Discord : un nom avec de la mise en forme s'affiche tel quel", async () => {
  const s = fauxServices();
  const store = nouveauStore();
  await creerPaiement(checkout({ moyen: "carte", firstName: "**Jo**", lastName: "@everyone", email: "jo@ex.com" }), store, { env: envDiscord, fetcher: s.fetcher, ip: "4.4.4.4" });
  const token = s.appels.find((a) => a.url.endsWith("/stores/cart/checkout")).corps.meta.token;
  await statutPaiement(statut(token), store, { env: envDiscord, fetcher: s.fetcher });
  const { embeds, allowed_mentions } = messagesDiscord(s)[0].corps;
  assert.match(embeds[0].description, /^💸Maneyy! \\\*\\\*Jo\\\*\\\* @everyone a rejoint Creato!/);
  assert.deepEqual(allowed_mentions, { parse: [] });
});

test("Discord : si le message échoue, le client reçoit quand même son code", async () => {
  const s = fauxServices({ discord: 403 });
  const { r } = await payerEtVerifier(s, nouveauStore(), "carte");
  assert.deepEqual(r, { status: "SUCCESS", code: "CODE-TEST", community: "https://whop.test/acces" });
});
