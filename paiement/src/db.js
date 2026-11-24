'use strict';

const fs = require('fs');
const path = require('path');

// SQLite intégré à Node (>= 22.13). Un seul fichier, sur un volume persistant.
// Les migrations sont numérotées (PRAGMA user_version) et ne perdent jamais de données.

const SCHEMA_V2 = `
  CREATE TABLE IF NOT EXISTS membres (
    id                   INTEGER PRIMARY KEY AUTOINCREMENT,
    programme            TEXT NOT NULL DEFAULT 'community' CHECK (programme IN ('community', 'elite')),
    email                TEXT NOT NULL,             -- email utilisé au paiement (= réponse attendue sur Whop)
    nom                  TEXT NOT NULL,
    telephone            TEXT,
    discord_id           TEXT,
    discord_pseudo       TEXT,
    prix_renouvellement  TEXT,                      -- prix garanti à vie au moment de l'inscription
    devise               TEXT,
    acces_jusqu_au       TEXT NOT NULL,             -- ISO 8601 (UTC)
    statut               TEXT NOT NULL DEFAULT 'actif' CHECK (statut IN ('actif', 'expire')),
    whop_entry_id        TEXT,                      -- demande acceptée sur la liste d'attente Whop
    whop_membership_id   TEXT,
    whop_jours_a_ajouter INTEGER NOT NULL DEFAULT 0, -- prolongations Whop en attente
    categorie_elite      TEXT CHECK (categorie_elite IN ('insatisfait', 'inconstant')),
    rappel_coaching_min  INTEGER NOT NULL DEFAULT 240,
    code_promo           TEXT,                      -- ancien système (codes -100 %)
    cree_le              TEXT NOT NULL,
    maj_le               TEXT NOT NULL,
    UNIQUE (programme, email)
  );
  CREATE INDEX IF NOT EXISTS membres_discord ON membres(discord_id);

  CREATE TABLE IF NOT EXISTS invitations_elite (
    token       TEXT PRIMARY KEY,
    note        TEXT,
    cree_le     TEXT NOT NULL,
    utilisee_le TEXT,
    ref_commande TEXT
  );

  CREATE TABLE IF NOT EXISTS reservations (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    discord_id  TEXT NOT NULL,
    jour        INTEGER NOT NULL CHECK (jour BETWEEN 0 AND 6),   -- 0 = lundi
    heure       TEXT NOT NULL,                                    -- HH:MM GMT
    effectif_le TEXT NOT NULL,                                    -- date (AAAA-MM-JJ) de la première séance comptée
    cree_le     TEXT NOT NULL,
    UNIQUE (jour, heure)
  );
  CREATE INDEX IF NOT EXISTS reservations_membre ON reservations(discord_id);

  CREATE TABLE IF NOT EXISTS annulations (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    discord_id    TEXT NOT NULL,
    date          TEXT NOT NULL,
    heure         TEXT NOT NULL,
    justification TEXT NOT NULL,
    cree_le       TEXT NOT NULL,
    UNIQUE (date, heure)
  );

  CREATE TABLE IF NOT EXISTS envois (
    cle      TEXT PRIMARY KEY,   -- clé unique d'un message déjà envoyé (évite les doublons)
    envoye_le TEXT NOT NULL
  );
`;

function colonnes(db, table) {
  return db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name);
}

function migrer(db) {
  const version = db.prepare('PRAGMA user_version').get().user_version;
  if (version >= 2) return;

  db.exec('BEGIN');
  try {
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all().map((t) => t.name);

    // --- membres : v1 (email unique, une seule offre) → v2 (programme + email) ---
    if (tables.includes('membres') && !colonnes(db, 'membres').includes('programme')) {
      db.exec('ALTER TABLE membres RENAME TO membres_v1');
      db.exec(SCHEMA_V2);
      db.exec(`INSERT INTO membres (id, programme, email, nom, telephone, discord_id, code_promo, acces_jusqu_au, statut, cree_le, maj_le)
               SELECT id, 'community', email, nom, telephone, discord_id, code_promo, acces_jusqu_au,
                      CASE WHEN acces_jusqu_au < strftime('%Y-%m-%dT%H:%M:%fZ','now') THEN 'expire' ELSE 'actif' END,
                      cree_le, maj_le
               FROM membres_v1`);
      db.exec('DROP TABLE membres_v1');
    }

    // --- commandes ---
    if (!tables.includes('commandes')) {
      db.exec(`CREATE TABLE commandes (
        ref               TEXT PRIMARY KEY,
        programme         TEXT NOT NULL DEFAULT 'community',
        type              TEXT NOT NULL CHECK (type IN ('inscription', 'renouvellement')),
        email             TEXT NOT NULL,
        nom               TEXT NOT NULL,
        telephone         TEXT,
        montant           TEXT NOT NULL,
        devise            TEXT NOT NULL,
        saspay_session_id TEXT UNIQUE,
        saspay_tx_id      TEXT,
        statut            TEXT NOT NULL DEFAULT 'EN_ATTENTE' CHECK (statut IN ('EN_ATTENTE', 'PAYEE', 'ECHEC')),
        code_promo        TEXT,
        invitation_token  TEXT,
        cree_le           TEXT NOT NULL,
        payee_le          TEXT
      )`);
    } else {
      const c = colonnes(db, 'commandes');
      if (!c.includes('programme')) db.exec("ALTER TABLE commandes ADD COLUMN programme TEXT NOT NULL DEFAULT 'community'");
      if (!c.includes('invitation_token')) db.exec('ALTER TABLE commandes ADD COLUMN invitation_token TEXT');
    }
    db.exec('CREATE INDEX IF NOT EXISTS commandes_email ON commandes(email)');

    db.exec(SCHEMA_V2);
    db.exec('PRAGMA user_version = 2');
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

// v3 : préférences de coaching par compte Discord (membres mobile money ET membres payés sur Whop).
function migrerV3(db) {
  if (db.prepare('PRAGMA user_version').get().user_version >= 3) return;
  db.exec(`CREATE TABLE IF NOT EXISTS profils_coaching (
    discord_id  TEXT PRIMARY KEY,
    pseudo      TEXT,
    rappel_min  INTEGER NOT NULL DEFAULT 240,
    maj_le      TEXT NOT NULL
  );
  INSERT OR IGNORE INTO profils_coaching (discord_id, pseudo, rappel_min, maj_le)
    SELECT discord_id, discord_pseudo, rappel_coaching_min, maj_le FROM membres WHERE programme = 'elite' AND discord_id IS NOT NULL;
  PRAGMA user_version = 3;`);
}

// v4 : date à laquelle l'accès Whop a été coupé par le site.
function migrerV4(db) {
  if (db.prepare('PRAGMA user_version').get().user_version >= 4) return;
  if (!colonnes(db, 'membres').includes('whop_annule_le')) db.exec('ALTER TABLE membres ADD COLUMN whop_annule_le TEXT');
  db.exec('PRAGMA user_version = 4');
}

function ouvrirBase(fichier) {
  // Masque l'avertissement « expérimental » de node:sqlite, sans toucher aux autres avertissements.
  const emettre = process.emitWarning;
  process.emitWarning = (w, ...r) => (String(w).includes('SQLite') ? undefined : emettre.call(process, w, ...r));
  const { DatabaseSync } = require('node:sqlite');
  process.emitWarning = emettre;

  if (fichier !== ':memory:') fs.mkdirSync(path.dirname(path.resolve(fichier)), { recursive: true });
  const db = new DatabaseSync(fichier);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;');
  migrer(db);
  migrerV3(db);
  migrerV4(db);
  return db;
}

// Les anciens membres n'ont pas de prix garanti enregistré : on leur attribue le prix actuel.
function completerPrixGarantis(db, config) {
  for (const o of Object.values(config.offres)) {
    db.prepare('UPDATE membres SET prix_renouvellement = ?, devise = ? WHERE programme = ? AND prix_renouvellement IS NULL')
      .run(Number(o.prixRenouvellement).toFixed(2), config.devise, o.id);
  }
}

module.exports = { ouvrirBase, completerPrixGarantis };
