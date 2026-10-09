// Paiement SasPay de la page TikTok Elite (/paiement/), repris du petit serveur de creatoskills.site.
// La clé API et le code d'accès ne quittent jamais Netlify : le code n'est donné qu'après un paiement SUCCESS
// vérifié auprès de SasPay. Réglages dans les variables d'environnement Netlify (voir README).
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { discordConfigure, envoyerDiscord } from "./discord.mjs";

export function reglages(env = process.env) {
  const cfg = {
    siteUrl: (env.SITE_URL || env.URL || "").replace(/\/$/, ""),
    apiUrl: (env.SASPAY_API_URL || "https://api.saspay.me/api/v1").replace(/\/$/, ""),
    apiKey: env.SASPAY_API_KEY || "",
    webhookSecret: env.SASPAY_WEBHOOK_SECRET || "",
    amount: env.SASPAY_AMOUNT || "120.00",
    currency: env.SASPAY_CURRENCY || "EUR",
    description: env.SASPAY_DESCRIPTION || "TikTok Elite",
    accessCode: env.ACCESS_CODE || "",
    communityUrl: env.COMMUNITY_URL || "",
  };
  cfg.manquants = ["apiKey", "accessCode", "communityUrl", "siteUrl"].filter((k) => !cfg[k]);
  if (!/^\d+\.\d{2}$/.test(cfg.amount)) cfg.manquants.push("amount");
  return cfg;
}

const json = (status, data) =>
  new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });

async function saspay(cfg, fetcher, method, route, body) {
  const res = await fetcher(cfg.apiUrl + route, {
    method,
    headers: { Authorization: `Bearer ${cfg.apiKey}`, "Content-Type": "application/json", Accept: "application/json" },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(20_000),
  });
  const j = await res.json().catch(() => ({}));
  // Enveloppe documentée : { success, data, code } ; certains exemples renvoient directement l'objet.
  const data = j && typeof j === "object" && "data" in j ? j.data : j;
  if (!res.ok || j?.success === false) {
    const err = new Error(`SasPay ${method} ${route} → ${res.status}`);
    err.detail = j?.error ?? j;
    throw err;
  }
  return data;
}

// Petite limite anti-abus : 8 paiements créés par adresse IP toutes les 10 minutes.
async function tropDeTentatives(store, ip, now) {
  const cle = `limites/${String(ip || "inconnue").replace(/[^A-Za-z0-9.]/g, "-")}`;
  const liste = ((await store.get(cle, { type: "json" })) ?? []).filter((t) => now - t < 10 * 60_000);
  liste.push(now);
  await store.setJSON(cle, liste);
  return liste.length > 8;
}

// POST /api/checkout  { name, email } → { url } (page de paiement SasPay)
export async function creerPaiement(req, store, { env = process.env, fetcher = fetch, ip = "", now = Date.now() } = {}) {
  if (req.method !== "POST") return json(405, { error: "Méthode non autorisée." });
  const cfg = reglages(env);
  if (cfg.manquants.length) return json(503, { error: "Le paiement n'est pas encore activé. Réessaie plus tard." });
  if (await tropDeTentatives(store, ip, now)) return json(429, { error: "Trop de tentatives. Réessaie dans quelques minutes." });
  let input;
  try {
    input = await req.json();
  } catch {
    return json(400, { error: "Requête invalide." });
  }
  const name = String(input?.name ?? "").trim().replace(/\s+/g, " ").slice(0, 80);
  const email = String(input?.email ?? "").trim().toLowerCase().slice(0, 120);
  if (name.length < 2) return json(400, { error: "Indique ton nom." });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return json(400, { error: "Adresse e-mail invalide." });

  const token = randomUUID();
  try {
    const s = await saspay(cfg, fetcher, "POST", "/checkout-sessions/", {
      amount: cfg.amount,
      currency: cfg.currency,
      description: cfg.description,
      customer_email: email,
      customer_name: name,
      return_url: `${cfg.siteUrl}/paiement/merci.html?s=${token}`,
      metadata: { token },
    });
    if (!s?.id || !s?.checkout_url) throw new Error("Réponse SasPay sans id ou checkout_url");
    await store.setJSON(`sessions/${token}`, { sessionId: s.id, name, email, createdAt: new Date(now).toISOString(), paid: false });
    return json(200, { url: s.checkout_url });
  } catch (e) {
    console.error("Création du paiement impossible :", e.message, JSON.stringify(e.detail ?? ""));
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
  try {
    // L'endpoint de statut revérifie l'état réel auprès du gateway.
    const st = await saspay(cfg, fetcher, "GET", `/checkout-sessions/${encodeURIComponent(entry.sessionId)}/status/`);
    if (st?.transaction_status === "SUCCESS" && st?.transaction_id) {
      // Double contrôle sur la transaction elle-même : seul SUCCESS autorise l'accès.
      const tx = await saspay(cfg, fetcher, "GET", `/payments/${encodeURIComponent(st.transaction_id)}/verify/`);
      if (tx?.status === "SUCCESS") {
        const paye = { ...entry, paid: true, paidAt: new Date(now).toISOString(), transactionId: st.transaction_id, netAmount: tx.net_amount ?? null, paidCurrency: tx.currency ?? null };
        // Écriture conditionnelle : si deux onglets vérifient en même temps, un seul message Discord part.
        const { modified } = await store.setJSON(cle, paye, { onlyIfMatch: lu.etag });
        if (modified && discordConfigure(env)) {
          await envoyerDiscord(messagePaiement(paye), env, fetcher).catch((e) => console.error("Discord (paiement) :", e.message));
        }
        return success();
      }
    }
    if (st?.transaction_status === "FAILED") return json(200, { status: "FAILED" });
    return json(200, { status: "PENDING" });
  } catch (e) {
    console.error("Vérification impossible :", e.message);
    return json(200, { status: "PENDING" });
  }
}

const echapper = (s) => String(s).replace(/([\\*_~`|>#\[\]()-])/g, "\\$1");

export function messagePaiement(p) {
  const montant = p.netAmount != null ? `${p.netAmount} ${p.paidCurrency ?? ""}`.trim() : "?";
  return ["**Nouveau paiement TikTok Elite**", `Nom : ${echapper(p.name)}`, `E-mail : ${echapper(p.email)}`, `Montant net : ${echapper(montant)}`].join("\n");
}

// POST /api/saspay/webhook : signature vérifiée, puis simple journal.
// L'accès n'est donné qu'après vérification par l'API (route /api/status).
export async function webhookSaspay(req, store, { env = process.env, now = Date.now() } = {}) {
  const cfg = reglages(env);
  if (req.method !== "POST") return json(405, { ok: false });
  const raw = Buffer.from(await req.arrayBuffer());
  if (!raw.length || raw.length > 1024 * 1024 || !cfg.webhookSecret) return json(400, { ok: false });
  const signature = String(req.headers.get("x-webhook-signature") ?? "");
  const timestamp = String(req.headers.get("x-webhook-timestamp") ?? "");
  const age = Math.abs(Math.floor(now / 1000) - Number(timestamp));
  if (!/^\d+$/.test(timestamp) || age > 300) return json(403, { ok: false });
  const expected = createHmac("sha256", cfg.webhookSecret).update(Buffer.concat([Buffer.from(`${timestamp}.`), raw])).digest("hex");
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
