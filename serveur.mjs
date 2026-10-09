// Serveur du site Creato (creatoskills.site) : les pages de site/ et l'API.
//   /api/creneaux, /api/reserver            réservation d'un appel (message Discord)
//   /api/checkout, /api/status               paiement : carte → Maketou, mobile money → SasPay
//   /api/saspay/webhook                      notifications SasPay (signées)
//   /api/sante                               état des réglages (sans aucun secret)
// Aucune dépendance. Réglages lus dans un fichier .env (chemin SITE_ENV, défaut /run/site.env) ou l'environnement.
// Données (réservations, paiements) dans DATA_DIR (défaut /data).
import { createServer } from "node:http";
import { createReadStream, existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { discordConfigure } from "./lib/discord.mjs";
import { creerPaiement, reglages, statutPaiement, webhookSaspay } from "./lib/paiement.mjs";
import { listerCreneaux, reserver } from "./lib/reservations.mjs";
import { ouvrirStockage } from "./lib/stockage.mjs";

const ICI = path.dirname(fileURLToPath(import.meta.url));

// Fichier « CLE="valeur" » ; les variables déjà présentes dans l'environnement gardent la priorité.
export function chargerEnv(fichier, env = process.env) {
  if (!fichier || !existsSync(fichier)) return;
  for (const ligne of readFileSync(fichier, "utf8").split(/\r?\n/)) {
    const m = ligne.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (!m) continue;
    let v = m[2];
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (env[m[1]] === undefined) env[m[1]] = v;
  }
}

const TYPES = {
  ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".avif": "image/avif", ".webp": "image/webp",
  ".svg": "image/svg+xml", ".ico": "image/x-icon",
};
const ENTETES = { "X-Content-Type-Options": "nosniff", "Referrer-Policy": "strict-origin-when-cross-origin" };

function servirFichier(req, res, racine, url) {
  let rel;
  try {
    rel = decodeURIComponent(url.pathname);
  } catch {
    rel = "/introuvable";
  }
  // /paiement → /paiement/ (les liens relatifs de la page en dépendent).
  const dossier = path.join(racine, path.normalize(rel));
  if (!rel.endsWith("/") && !path.extname(rel) && dossier.startsWith(racine + path.sep) && existsSync(path.join(dossier, "index.html"))) {
    res.writeHead(301, { Location: `${rel}/${url.search}`, ...ENTETES });
    return res.end();
  }
  if (rel.endsWith("/")) rel += "index.html";
  const f = path.join(racine, path.normalize(rel));
  const type = TYPES[path.extname(f).toLowerCase()];
  if (!f.startsWith(racine + path.sep) || !type || !existsSync(f) || !statSync(f).isFile()) {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8", ...ENTETES });
    return res.end("Page introuvable");
  }
  const cache = /\.(html|css|js)$/.test(f) ? "no-cache" : "public, max-age=604800";
  res.writeHead(200, { "Content-Type": type, "Cache-Control": cache, ...ENTETES });
  if (req.method === "HEAD") return res.end();
  createReadStream(f).pipe(res);
}

async function lireCorps(req, limite = 1024 * 1024) {
  const morceaux = [];
  let taille = 0;
  for await (const c of req) {
    taille += c.length;
    if (taille > limite) throw Object.assign(new Error("trop gros"), { status: 413 });
    morceaux.push(c);
  }
  return Buffer.concat(morceaux);
}

// Requête Node → Request standard, pour les fonctions de lib/.
async function versRequest(req, url) {
  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) if (v !== undefined) headers.set(k, Array.isArray(v) ? v.join(", ") : v);
  const body = req.method === "GET" || req.method === "HEAD" ? undefined : await lireCorps(req);
  return new Request(url, { method: req.method, headers, body });
}

async function envoyer(res, reponse) {
  res.writeHead(reponse.status, { ...Object.fromEntries(reponse.headers), ...ENTETES });
  res.end(Buffer.from(await reponse.arrayBuffer()));
}

export function creerServeur({ racine = path.join(ICI, "site"), donnees = process.env.DATA_DIR ?? "/data", env = process.env } = {}) {
  const reservations = ouvrirStockage(path.join(donnees, "reservations"));
  const paiements = ouvrirStockage(path.join(donnees, "paiements"));
  racine = path.resolve(racine);

  return createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? "/", "http://localhost");
      const p = url.pathname;
      const m = req.method;
      // Adresse du visiteur, donnée par Caddy (qui remplace celle qu'un visiteur pourrait envoyer lui-même).
      const ip = String(req.headers["x-forwarded-for"] ?? req.socket.remoteAddress ?? "").split(",")[0].trim();
      if (p.startsWith("/api/")) {
        const request = await versRequest(req, `http://localhost${req.url}`);
        if (p === "/api/creneaux" && m === "GET") return await envoyer(res, await listerCreneaux(reservations));
        if (p === "/api/reserver" && m === "POST") return await envoyer(res, await reserver(request, reservations, { env }));
        if (p === "/api/checkout" && m === "POST") return await envoyer(res, await creerPaiement(request, paiements, { env, ip }));
        if (p === "/api/status" && m === "GET") return await envoyer(res, await statutPaiement(request, paiements, { env }));
        if (p === "/api/saspay/webhook" && m === "POST") return await envoyer(res, await webhookSaspay(request, paiements, { env }));
        if (p === "/api/sante" && m === "GET") {
          const cfg = reglages(env);
          return await envoyer(res, Response.json({ ok: true, reservations: discordConfigure(env), carte: !cfg.manquants.carte.length, mobileMoney: !cfg.manquants.mobile.length }));
        }
        return await envoyer(res, Response.json({ error: "Introuvable" }, { status: 404 }));
      }
      if (m === "GET" || m === "HEAD") return servirFichier(req, res, racine, url);
      res.writeHead(405, ENTETES);
      res.end();
    } catch (e) {
      console.error(e);
      if (!res.headersSent) {
        res.writeHead(e.status ?? 500, { "Content-Type": "application/json; charset=utf-8", ...ENTETES });
        res.end(JSON.stringify({ error: "Erreur" }));
      }
    }
  });
}

// Lancement direct : node serveur.mjs
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  chargerEnv(process.env.SITE_ENV ?? "/run/site.env");
  const port = Number(process.env.PORT ?? 8080);
  creerServeur({ racine: process.env.STATIC_DIR ?? path.join(ICI, "site") }).listen(port, () => {
    const cfg = reglages();
    const etat = (ok) => (ok ? "actif" : "fermé (réglages manquants)");
    console.log(`Site Creato sur le port ${port}`);
    console.log(`  réservations : ${etat(discordConfigure())}`);
    console.log(`  carte (Maketou) : ${etat(!cfg.manquants.carte.length)}${cfg.manquants.carte.length ? " — " + cfg.manquants.carte.join(", ") : ""}`);
    console.log(`  mobile money (SasPay) : ${etat(!cfg.manquants.mobile.length)}${cfg.manquants.mobile.length ? " — " + cfg.manquants.mobile.join(", ") : ""}`);
  });
}
