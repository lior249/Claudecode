// Paiement de la page TikTok Elite (/paiement/) : carte bancaire par Maketou, mobile money par SasPay.
// Les clés API et le code d'accès ne quittent jamais le serveur : le code n'est donné qu'après un paiement
// confirmé auprès du service de paiement. Réglages dans le fichier site.env du serveur (voir README).
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

export function reglages(env = process.env) {
  const cfg = {
    siteUrl: (env.SITE_URL || "https://creatoskills.site").replace(/\/$/, ""),
    accessCode: env.ACCESS_CODE || "",
    communityUrl: env.COMMUNITY_URL || "",
    saspay: {
      apiUrl: (env.SASPAY_API_URL || "https://api.saspay.me/api/v1").replace(/\/$/, ""),
      apiKey: env.SASPAY_API_KEY || "",
      webhookSecret: env.SASPAY_WEBHOOK_SECRET || "",
      amount: env.SASPAY_AMOUNT || "120.00",
      currency: env.SASPAY_CURRENCY || "EUR",
      description: env.SASPAY_DESCRIPTION || "TikTok Elite",
    },
    maketou: {
      apiUrl: (env.MAKETOU_API_URL || "https://api.maketou.net").replace(/\/$/, ""),
      apiKey: env.MAKETOU_API_KEY || "",
      // Identifiant public du produit « Accès unique à la formation » (Maketou → produit → Partager).
      productId: env.MAKETOU_PRODUCT_ID || "1aee38b8-746a-47ba-a638-fdb0c99f589b",
    },
  };
  const commun = [["ACCESS_CODE", cfg.accessCode], ["COMMUNITY_URL", cfg.communityUrl]].filter(([, v]) => !v).map(([k]) => k);
  cfg.manquants = {
    mobile: [...commun, ...(cfg.saspay.apiKey ? [] : ["SASPAY_API_KEY"]), ...(/^\d+\.\d{2}$/.test(cfg.saspay.amount) ? [] : ["SASPAY_AMOUNT"])],
    carte: [...commun, ...(cfg.maketou.apiKey ? [] : ["MAKETOU_API_KEY"]), ...(cfg.maketou.productId ? [] : ["MAKETOU_PRODUCT_ID"])],
  };
  return cfg;
}

const json = (status, data) =>
  new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });

// Appel d'une API de paiement (clé uniquement ici). `enveloppe` : SasPay répond { success, data, code }.
async function appeler(fetcher, { url, cle, method, body, enveloppe = false }) {
  const res = await fetcher(url, {
    method,
    headers: { Authorization: `Bearer ${cle}`, "Content-Type": "application/json", Accept: "application/json" },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(20_000),
  });
  const j = await res.json().catch(() => ({}));
  // Certains exemples SasPay renvoient directement l'objet, sans enveloppe.
  const data = enveloppe && j && typeof j === "object" && "data" in j ? j.data : j;
  if (!res.ok || (enveloppe && j?.success === false)) {
    const err = new Error(`${method} ${url} → ${res.status}`);
    err.detail = j?.error ?? j;
    throw err;
  }
  return data;
}

// ----- Les deux services -----
// creer(...) → { ref, url } ; verifier(...) → { statut: "SUCCESS" | "FAILED" | "PENDING", montant? }
const services = {
  // Mobile money : SasPay. Double contrôle : statut de la session, puis la transaction elle-même.
  mobile: {
    nom: "Mobile money (SasPay)",
    async creer(cfg, fetcher, { name, email, token, retour }) {
      const c = cfg.saspay;
      const s = await appeler(fetcher, {
        url: `${c.apiUrl}/checkout-sessions/`, cle: c.apiKey, method: "POST", enveloppe: true,
        body: { amount: c.amount, currency: c.currency, description: c.description, customer_email: email, customer_name: name, return_url: retour, metadata: { token } },
      });
      if (!s?.id || !s?.checkout_url) throw new Error("Réponse SasPay sans id ou checkout_url");
      return { ref: s.id, url: s.checkout_url };
    },
    async verifier(cfg, fetcher, entry) {
      const c = cfg.saspay;
      const st = await appeler(fetcher, { url: `${c.apiUrl}/checkout-sessions/${encodeURIComponent(entry.ref)}/status/`, cle: c.apiKey, method: "GET", enveloppe: true });
      if (st?.transaction_status === "SUCCESS" && st?.transaction_id) {
        const tx = await appeler(fetcher, { url: `${c.apiUrl}/payments/${encodeURIComponent(st.transaction_id)}/verify/`, cle: c.apiKey, method: "GET", enveloppe: true });
        if (tx?.status === "SUCCESS") {
          return { statut: "SUCCESS", transactionId: st.transaction_id, montant: tx.net_amount != null ? `${tx.net_amount} ${tx.currency ?? ""}`.trim() : null };
        }
      }
      if (st?.transaction_status === "FAILED") return { statut: "FAILED" };
      return { statut: "PENDING" };
    },
  },

  // Carte bancaire : Maketou (panier d'un seul produit, accès seulement si le panier est « completed »).
  carte: {
    nom: "Carte bancaire (Maketou)",
    async creer(cfg, fetcher, { firstName, lastName, email, token, retour }) {
      const c = cfg.maketou;
      const r = await appeler(fetcher, {
        url: `${c.apiUrl}/api/v1/stores/cart/checkout`, cle: c.apiKey, method: "POST",
        body: { productDocumentId: c.productId, email, firstName, lastName, redirectURL: retour, meta: { token } },
      });
      if (!r?.cart?.id || !r?.redirectUrl) throw new Error("Réponse Maketou sans cart.id ou redirectUrl");
      return { ref: r.cart.id, url: r.redirectUrl };
    },
    async verifier(cfg, fetcher, entry, token) {
      const c = cfg.maketou;
      const cart = await appeler(fetcher, { url: `${c.apiUrl}/api/v1/stores/cart/${encodeURIComponent(entry.ref)}`, cle: c.apiKey, method: "GET" });
      // Le panier doit bien être celui créé pour ce lien de retour.
      if (cart?.meta?.token && cart.meta.token !== token) return { statut: "FAILED" };
      if (cart?.status === "completed") return { statut: "SUCCESS", transactionId: cart.paymentId ?? null, montant: null };
      if (cart?.status === "payment_failed" || cart?.status === "abandoned") return { statut: "FAILED" };
      return { statut: "PENDING" };
    },
  },
};

// Petite limite anti-abus : 8 paiements créés par adresse IP toutes les 10 minutes.
async function tropDeTentatives(store, ip, now) {
  const cle = `limites/${String(ip || "inconnue").replace(/[^A-Za-z0-9.]/g, "-")}`;
  const liste = ((await store.get(cle, { type: "json" })) ?? []).filter((t) => now - t < 10 * 60_000);
  liste.push(now);
  await store.setJSON(cle, liste);
  return liste.length > 8;
}

const nettoyer = (v, max) => String(v ?? "").trim().replace(/\s+/g, " ").slice(0, max);

// POST /api/checkout  { moyen: "carte" | "mobile", firstName, lastName, email } → { url } (page de paiement)
export async function creerPaiement(req, store, { env = process.env, fetcher = fetch, ip = "", now = Date.now() } = {}) {
  if (req.method !== "POST") return json(405, { error: "Méthode non autorisée." });
  let input;
  try {
    input = await req.json();
  } catch {
    return json(400, { error: "Requête invalide." });
  }
  const moyen = input?.moyen === "carte" ? "carte" : input?.moyen === "mobile" ? "mobile" : null;
  if (!moyen) return json(400, { error: "Choisis un moyen de paiement." });
  const cfg = reglages(env);
  if (cfg.manquants[moyen].length) return json(503, { error: "Ce moyen de paiement n'est pas encore activé. Réessaie plus tard." });
  if (await tropDeTentatives(store, ip, now)) return json(429, { error: "Trop de tentatives. Réessaie dans quelques minutes." });

  const firstName = nettoyer(input.firstName, 40);
  const lastName = nettoyer(input.lastName, 40);
  const email = String(input.email ?? "").trim().toLowerCase().slice(0, 120);
  if (!firstName) return json(400, { error: "Indique ton prénom." });
  if (!lastName) return json(400, { error: "Indique ton nom." });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return json(400, { error: "Adresse e-mail invalide." });
  const name = `${firstName} ${lastName}`;

  const token = randomUUID();
  const retour = `${cfg.siteUrl}/paiement/merci.html?s=${token}`;
  try {
    const { ref, url } = await services[moyen].creer(cfg, fetcher, { name, firstName, lastName, email, token, retour });
    await store.setJSON(`sessions/${token}`, { moyen, ref, name, email, createdAt: new Date(now).toISOString(), paid: false });
    return json(200, { url });
  } catch (e) {
    console.error(`Création du paiement (${moyen}) impossible :`, e.message, JSON.stringify(e.detail ?? ""));
    return json(502, { error: "Le paiement est momentanément indisponible. Réessaie dans un instant." });
  }
}

// GET /api/status?s=… → SUCCESS (avec le code), FAILED, PENDING ou UNKNOWN
export async function statutPaiement(req, store, { env = process.env, fetcher = fetch, now = Date.now() } = {}) {
  const cfg = reglages(env);
  const token = new URL(req.url).searchParams.get("s") ?? "";
  if (!/^[0-9a-f-]{36}$/.test(token)) return json(404, { status: "UNKNOWN" });
  const cle = `sessions/${token}`;
  const lu = await store.getWithMetadata(cle, { type: "json" });
  if (!lu) return json(404, { status: "UNKNOWN" });
  const entry = lu.data;
  const success = () => json(200, { status: "SUCCESS", code: cfg.accessCode, community: cfg.communityUrl });
  if (entry.paid) return success();
  const service = services[entry.moyen];
  if (!service) return json(404, { status: "UNKNOWN" });
  try {
    const v = await service.verifier(cfg, fetcher, entry, token);
    if (v.statut === "SUCCESS") {
      const paye = { ...entry, paid: true, paidAt: new Date(now).toISOString(), transactionId: v.transactionId, montant: v.montant };
      // Écriture conditionnelle : si deux onglets vérifient en même temps, le paiement n'est noté qu'une fois.
      const { modified } = await store.setJSON(cle, paye, { onlyIfMatch: lu.etag });
      if (modified) console.log(`Paiement réussi — ${service.nom} — ${paye.name} <${paye.email}>${paye.montant ? ` — ${paye.montant}` : ""}`);
      return success();
    }
    return json(200, { status: v.statut });
  } catch (e) {
    console.error("Vérification impossible :", e.message);
    return json(200, { status: "PENDING" });
  }
}

// POST /api/saspay/webhook : signature vérifiée, puis simple journal.
// L'accès n'est donné qu'après vérification par l'API (route /api/status).
export async function webhookSaspay(req, store, { env = process.env, now = Date.now() } = {}) {
  const secret = reglages(env).saspay.webhookSecret;
  if (req.method !== "POST") return json(405, { ok: false });
  const raw = Buffer.from(await req.arrayBuffer());
  if (!raw.length || raw.length > 1024 * 1024 || !secret) return json(400, { ok: false });
  const signature = String(req.headers.get("x-webhook-signature") ?? "");
  const timestamp = String(req.headers.get("x-webhook-timestamp") ?? "");
  const age = Math.abs(Math.floor(now / 1000) - Number(timestamp));
  if (!/^\d+$/.test(timestamp) || age > 300) return json(403, { ok: false });
  const expected = createHmac("sha256", secret).update(Buffer.concat([Buffer.from(`${timestamp}.`), raw])).digest("hex");
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return json(403, { ok: false });
  let payload = {};
  try {
    payload = JSON.parse(raw.toString("utf8"));
  } catch {}
  const d = payload.data ?? {};
  await store.setJSON(`webhooks/${new Date(now).toISOString().replace(/[:.]/g, "-")}-${randomUUID().slice(0, 8)}`, {
    event: payload.event, id: d.id, status: d.status, net_amount: d.net_amount, currency: d.currency,
  });
  return json(200, { ok: true });
}
