// Petit stockage « clé → texte » dans des fichiers, sur le disque du serveur.
// Une clé comme « sessions/abc » devient le fichier <dossier>/sessions/abc.json.
// Le site tourne dans un seul processus Node et chaque opération est synchrone :
// « vérifier puis écrire » (onlyIfNew, onlyIfMatch) ne peut donc pas être interrompu par une autre requête.
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, readdirSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";

const CLE = /^[A-Za-z0-9._-]+(\/[A-Za-z0-9._-]+)*$/;

export function ouvrirStockage(dossier) {
  mkdirSync(dossier, { recursive: true });

  const fichier = (key) => {
    if (!CLE.test(key) || key.split("/").some((p) => p === "." || p === "..")) throw new Error(`clé invalide : ${key}`);
    return path.join(dossier, ...key.split("/")) + ".json";
  };
  const lire = (key) => {
    try {
      return readFileSync(fichier(key), "utf8");
    } catch (e) {
      if (e.code === "ENOENT") return null;
      throw e;
    }
  };
  const etag = (texte) => createHash("sha256").update(texte).digest("hex");
  const decoder = (texte, type) => (type === "json" ? JSON.parse(texte) : texte);

  function set(key, value, { onlyIfNew = false, onlyIfMatch } = {}) {
    const actuel = lire(key);
    if (onlyIfNew && actuel !== null) return { modified: false };
    if (onlyIfMatch !== undefined && (actuel === null || etag(actuel) !== onlyIfMatch)) return { modified: false };
    const f = fichier(key);
    mkdirSync(path.dirname(f), { recursive: true });
    // Écriture dans un fichier temporaire puis renommage : jamais de fichier à moitié écrit.
    const tmp = `${f}.${process.pid}.tmp`;
    writeFileSync(tmp, String(value));
    renameSync(tmp, f);
    return { modified: true };
  }

  // Toutes les clés sous un préfixe (ex. « sessions/ »).
  function cles(prefix) {
    const base = prefix.includes("/") ? prefix.slice(0, prefix.lastIndexOf("/")) : "";
    const out = [];
    const parcourir = (rel) => {
      let entrees;
      try {
        entrees = readdirSync(path.join(dossier, ...rel.split("/").filter(Boolean)), { withFileTypes: true });
      } catch (e) {
        if (e.code === "ENOENT") return;
        throw e;
      }
      for (const e of entrees) {
        const nom = rel ? `${rel}/${e.name}` : e.name;
        if (e.isDirectory()) parcourir(nom);
        else if (e.name.endsWith(".json")) out.push(nom.slice(0, -5));
      }
    };
    parcourir(base);
    return out.filter((k) => k.startsWith(prefix)).sort();
  }

  // Les méthodes sont « async » pour garder la même forme que l'ancien stockage, mais rien n'attend entre
  // la lecture et l'écriture.
  return {
    async get(key, { type } = {}) {
      const t = lire(key);
      return t === null ? null : decoder(t, type);
    },
    async getWithMetadata(key, { type } = {}) {
      const t = lire(key);
      return t === null ? null : { data: decoder(t, type), etag: etag(t) };
    },
    async set(key, value, opts) {
      return set(key, value, opts);
    },
    async setJSON(key, data, opts) {
      return set(key, JSON.stringify(data), opts);
    },
    async delete(key) {
      try {
        unlinkSync(fichier(key));
      } catch (e) {
        if (e.code !== "ENOENT") throw e;
      }
    },
    async list({ prefix = "" } = {}) {
      return { blobs: cles(prefix).map((key) => ({ key })) };
    },
  };
}
