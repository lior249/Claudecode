// Serveur de la page TikTok Elite : fichiers de la page + paiement SasPay vérifié côté serveur.
// Aucune dépendance. Réglages lus dans un fichier .env (chemin LANDING_ENV, défaut /run/landing.env) ou l'environnement.
// La clé API et le code d'accès ne quittent jamais le serveur : le code n'est envoyé qu'après un paiement SUCCESS.
import { createServer } from "node:http";
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { readFileSync, existsSync, mkdirSync, appendFileSync, writeFileSync, renameSync, statSync, createReadStream } from "node:fs";
import path from "node:path";

// ----- Réglages -----
function loadEnvFile(file) {
  if (!file || !existsSync(file)) return {};
  const out = {};
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    let v = m[2];
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    out[m[1]] = v;
  }
  return out;
}
const env = { ...loadEnvFile(process.env.LANDING_ENV ?? "/run/landing.env"), ...process.env };
const cfg = {
  port: Number(env.PORT ?? 8080),
  root: path.resolve(env.STATIC_DIR ?? path.dirname(new URL(import.meta.url).pathname)),
  dataDir: env.DATA_DIR ?? "/data",
  siteUrl: (env.SITE_URL ?? "https://creatoskills.site").replace(/\/$/, ""),
  apiUrl: (env.SASPAY_API_URL ?? "https://api.saspay.me/api/v1").replace(/\/$/, ""),
  apiKey: env.SASPAY_API_KEY ?? "",
  webhookSecret: env.SASPAY_WEBHOOK_SECRET ?? "",
  amount: env.SASPAY_AMOUNT ?? "120.00",
  currency: env.SASPAY_CURRENCY ?? "EUR",
  description: env.SASPAY_DESCRIPTION ?? "TikTok Elite",
  accessCode: env.ACCESS_CODE ?? "",
  communityUrl: env.COMMUNITY_URL ?? "",
};
if (!/^\d+\.\d{2}$/.test(cfg.amount)) throw new Error("SASPAY_AMOUNT doit être une chaîne décimale, ex. 120.00");
const missing = ["apiKey", "accessCode", "communityUrl"].filter((k) => !cfg[k]);
if (missing.length) console.warn(`⚠️  Réglages manquants : ${missing.join(", ")} — le paiement est désactivé.`);
mkdirSync(cfg.dataDir, { recursive: true });

// ----- Sessions de paiement (petit fichier JSON) -----
const SESSIONS = path.join(cfg.dataDir, "sessions.json");
let sessions = existsSync(SESSIONS) ? JSON.parse(readFileSync(SESSIONS, "utf8")) : {};
function saveSessions() {
  const tmp = SESSIONS + ".tmp";
  writeFileSync(tmp, JSON.stringify(sessions, null, 1));
  renameSync(tmp, SESSIONS);
}
const log = (file, entry) => appendFileSync(path.join(cfg.dataDir, file), JSON.stringify({ at: new Date().toISOString(), ...entry }) + "\n");

// ----- Appels SasPay (clé uniquement ici) -----
async function saspay(method, route, body) {
  const res = await fetch(cfg.apiUrl + route, {
    method,
    headers: { Authorization: `Bearer ${cfg.apiKey}`, "Content-Type": "application/json", Accept: "application/json" },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(20_000),
  });
  const json = await res.json().catch(() => ({}));
  // Enveloppe documentée : { success, data, code } ; certains exemples renvoient directement l'objet.
  const data = json && typeof json === "object" && "data" in json ? json.data : json;
  if (!res.ok || json?.success === false) {
    const err = new Error(`SasPay ${method} ${route} → ${res.status}`);
    err.status = res.status;
    err.detail = json?.error ?? json;
    throw err;
  }
  return data;
}

// ----- Petite limite anti-abus sur la création de paiements -----
const hits = new Map();
function tooMany(ip) {
  const now = Date.now();
  const list = (hits.get(ip) ?? []).filter((t) => now - t < 10 * 60_000);
  list.push(now);
  hits.set(ip, list);
  return list.length > 8;
}

// ----- Utilitaires HTTP -----
const send = (res, status, obj) => {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  res.end(JSON.stringify(obj));
};
async function readBody(req, limit = 64 * 1024) {
  const chunks = [];
  let size = 0;
  for await (const c of req) {
    size += c.length;
    if (size > limit) throw Object.assign(new Error("trop gros"), { status: 413 });
    chunks.push(c);
  }
  return Buffer.concat(chunks);
}
const clientIp = (req) => String(req.headers["x-forwarded-for"] ?? req.socket.remoteAddress ?? "").split(",")[0].trim();

// ----- Routes -----
async function createCheckout(req, res) {
  if (missing.length) return send(res, 503, { error: "Le paiement n'est pas encore activé. Réessaie plus tard." });
  if (tooMany(clientIp(req))) return send(res, 429, { error: "Trop de tentatives. Réessaie dans quelques minutes." });
  let input;
  try {
    input = JSON.parse((await readBody(req)).toString("utf8"));
  } catch {
    return send(res, 400, { error: "Requête invalide." });
  }
  const name = String(input?.name ?? "").trim().replace(/\s+/g, " ").slice(0, 80);
  const email = String(input?.email ?? "").trim().toLowerCase().slice(0, 120);
  if (name.length < 2) return send(res, 400, { error: "Indique ton nom." });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return send(res, 400, { error: "Adresse e-mail invalide." });

  const token = randomUUID();
  try {
    const s = await saspay("POST", "/checkout-sessions/", {
      amount: cfg.amount,
      currency: cfg.currency,
      description: cfg.description,
      customer_email: email,
      customer_name: name,
      return_url: `${cfg.siteUrl}/merci.html?s=${token}`,
      metadata: { token },
    });
    if (!s?.id || !s?.checkout_url) throw new Error("Réponse SasPay sans id ou checkout_url");
    sessions[token] = { sessionId: s.id, name, email, createdAt: new Date().toISOString(), paid: false };
    saveSessions();
    log("journal.jsonl", { type: "checkout.created", token, sessionId: s.id, email });
    return send(res, 200, { url: s.checkout_url });
  } catch (e) {
    log("journal.jsonl", { type: "checkout.error", email, status: e.status, detail: e.detail ?? e.message });
    console.error("Création du paiement impossible :", e.message, JSON.stringify(e.detail ?? ""));
    return send(res, 502, { error: "Le paiement est momentanément indisponible. Réessaie dans un instant." });
  }
}

async function paymentStatus(req, res, url) {
  const token = url.searchParams.get("s") ?? "";
  const entry = sessions[token];
  if (!entry) return send(res, 404, { status: "UNKNOWN" });
  const success = () => send(res, 200, { status: "SUCCESS", code: cfg.accessCode, community: cfg.communityUrl });
  if (entry.paid) return success();
  try {
    // L'endpoint de statut revérifie l'état réel auprès du gateway.
    const st = await saspay("GET", `/checkout-sessions/${encodeURIComponent(entry.sessionId)}/status/`);
    if (st?.transaction_status === "SUCCESS" && st?.transaction_id) {
      // Double contrôle sur la transaction elle-même : seul SUCCESS autorise l'accès.
      const tx = await saspay("GET", `/payments/${encodeURIComponent(st.transaction_id)}/verify/`);
      if (tx?.status === "SUCCESS") {
        entry.paid = true;
        entry.paidAt = new Date().toISOString();
        entry.transactionId = st.transaction_id;
        entry.netAmount = tx.net_amount ?? null;
        entry.paidCurrency = tx.currency ?? null;
        saveSessions();
        log("paiements.jsonl", { token, name: entry.name, email: entry.email, transactionId: st.transaction_id, net_amount: tx.net_amount, currency: tx.currency });
        return success();
      }
    }
    if (st?.transaction_status === "FAILED") return send(res, 200, { status: "FAILED" });
    return send(res, 200, { status: "PENDING" });
  } catch (e) {
    console.error("Vérification impossible :", e.message);
    return send(res, 200, { status: "PENDING" });
  }
}

async function webhook(req, res) {
  const raw = await readBody(req, 1024 * 1024).catch(() => null);
  if (!raw || !cfg.webhookSecret) return send(res, 400, { ok: false });
  const signature = String(req.headers["x-webhook-signature"] ?? "");
  const timestamp = String(req.headers["x-webhook-timestamp"] ?? "");
  const age = Math.abs(Math.floor(Date.now() / 1000) - Number(timestamp));
  if (!/^\d+$/.test(timestamp) || age > 300) return send(res, 403, { ok: false });
  const expected = createHmac("sha256", cfg.webhookSecret).update(Buffer.concat([Buffer.from(`${timestamp}.`), raw])).digest("hex");
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return send(res, 403, { ok: false });
  let payload = {};
  try {
    payload = JSON.parse(raw.toString("utf8"));
  } catch {}
  // Simple journal : l'accès n'est donné qu'après vérification par l'API (route /api/status).
  log("webhooks.jsonl", { event: payload.event, id: payload.data?.id, status: payload.data?.status, net_amount: payload.data?.net_amount, currency: payload.data?.currency });
  return send(res, 200, { ok: true });
}

// ----- Fichiers de la page -----
const TYPES = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".avif": "image/avif", ".webp": "image/webp", ".svg": "image/svg+xml", ".ico": "image/x-icon" };
function serveStatic(req, res, url) {
  let rel = decodeURIComponent(url.pathname);
  if (rel === "/") rel = "/index.html";
  const file = path.join(cfg.root, path.normalize(rel));
  const type = TYPES[path.extname(file).toLowerCase()];
  if (!file.startsWith(cfg.root + path.sep) || !type || path.basename(file) === "server.mjs" || !existsSync(file) || !statSync(file).isFile()) {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    return res.end("Introuvable");
  }
  const cache = /\.(html|css|js)$/.test(file) ? "no-cache" : "public, max-age=604800";
  res.writeHead(200, { "Content-Type": type, "Cache-Control": cache, "X-Content-Type-Options": "nosniff" });
  if (req.method === "HEAD") return res.end();
  createReadStream(file).pipe(res);
}

createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? "/", "http://localhost");
    if (url.pathname === "/api/checkout" && req.method === "POST") return await createCheckout(req, res);
    if (url.pathname === "/api/status" && req.method === "GET") return await paymentStatus(req, res, url);
    if (url.pathname === "/api/saspay/webhook" && req.method === "POST") return await webhook(req, res);
    if (url.pathname === "/api/health") return send(res, 200, { ok: true, payments: missing.length === 0 });
    if (req.method === "GET" || req.method === "HEAD") return serveStatic(req, res, url);
    send(res, 405, { error: "Méthode non autorisée" });
  } catch (e) {
    console.error(e);
    if (!res.headersSent) send(res, e.status ?? 500, { error: "Erreur" });
  }
}).listen(cfg.port, () => console.log(`TikTok Elite sur le port ${cfg.port} (paiement ${missing.length ? "désactivé" : "actif"}, ${cfg.amount} ${cfg.currency})`));
