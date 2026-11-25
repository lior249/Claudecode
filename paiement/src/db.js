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

// v5 : candidatures Elite (formulaire → examen → retenu → vidéo → validé / refusé).
function migrerV5(db) {
  if (db.prepare('PRAGMA user_version').get().user_version >= 5) return;
  db.exec(`CREATE TABLE IF NOT EXISTS candidatures (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    discord_id       TEXT NOT NULL UNIQUE,
    pseudo           TEXT,
    statut           TEXT NOT NULL DEFAULT 'formulaire'
                     CHECK (statut IN ('formulaire', 'examen', 'retenu', 'video', 'refuse', 'valide')),
    reponses         TEXT,                -- JSON : [{ label, valeur }]
    video_fichier    TEXT,
    video_type       TEXT,
    video_taille     INTEGER,
    invitation_token TEXT,
    cree_le          TEXT NOT NULL,
    maj_le           TEXT NOT NULL,
    decision_le      TEXT
  );
  PRAGMA user_version = 5;`);
}

// v6 : code court affiché après le paiement, à taper dans Discord (/lier CODE) pour relier son compte.
function migrerV6(db) {
  if (db.prepare('PRAGMA user_version').get().user_version >= 6) return;
  if (!colonnes(db, 'commandes').includes('code_liaison')) db.exec('ALTER TABLE commandes ADD COLUMN code_liaison TEXT');
  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS commandes_code_liaison ON commandes(code_liaison); PRAGMA user_version = 6;');
}

// v7 : réponses du formulaire de confirmation (profils retenus).
function migrerV7(db) {
  if (db.prepare('PRAGMA user_version').get().user_version >= 7) return;
  if (!colonnes(db, 'candidatures').includes('reponses_confirmation')) db.exec('ALTER TABLE candidatures ADD COLUMN reponses_confirmation TEXT');
  db.exec('PRAGMA user_version = 7');
}

// v8 : chaque commande garde le compte Discord connecté au moment du paiement (rôle donné tout seul ensuite).
function migrerV8(db) {
  if (db.prepare('PRAGMA user_version').get().user_version >= 8) return;
  const c = colonnes(db, 'commandes');
  if (!c.includes('discord_id')) db.exec('ALTER TABLE commandes ADD COLUMN discord_id TEXT');
  if (!c.includes('discord_pseudo')) db.exec('ALTER TABLE commandes ADD COLUMN discord_pseudo TEXT');
  db.exec('PRAGMA user_version = 8');
}

// v9 : le membre peut indiquer l'email qu'il a donné à Whop s'il diffère de celui du paiement.
function migrerV9(db) {
  if (db.prepare('PRAGMA user_version').get().user_version >= 9) return;
  if (!colonnes(db, 'membres').includes('email_whop')) db.exec('ALTER TABLE membres ADD COLUMN email_whop TEXT');
  db.exec('PRAGMA user_version = 9');
}

// v10 : membres payés par carte (repérés par le rôle que Whop leur donne) et progression dans les cours Whop.
function migrerV10(db) {
  if (db.prepare('PRAGMA user_version').get().user_version >= 10) return;
  if (!colonnes(db, 'membres').includes('whop_user_id')) db.exec('ALTER TABLE membres ADD COLUMN whop_user_id TEXT');
  db.exec(`
  CREATE TABLE IF NOT EXISTS abonnes_carte (
    discord_id  TEXT NOT NULL,
    programme   TEXT NOT NULL,
    pseudo      TEXT,
    depuis      TEXT NOT NULL,
    perdu_le    TEXT,            -- rôle retiré par Whop (paiement par carte arrêté)
    termine_le  TEXT,            -- fin de l'attente (Community) ou départ du serveur
    PRIMARY KEY (discord_id, programme)
  );
  CREATE TABLE IF NOT EXISTS cours_whop (
    id      TEXT PRIMARY KEY,
    titre   TEXT,
    lecons  INTEGER NOT NULL DEFAULT 0,
    maj_le  TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS progression_whop (
    whop_user_id TEXT NOT NULL,
    cours_id     TEXT NOT NULL,
    lecon_id     TEXT NOT NULL,
    termine      INTEGER NOT NULL DEFAULT 0,
    maj_le       TEXT NOT NULL,
    PRIMARY KEY (whop_user_id, lecon_id)
  );
  PRAGMA user_version = 10;`);
}

// v11 : parcours de l'accompagnement Elite (étapes, envois du membre, remarques du coach, coaching d'entrée).
function migrerV11(db) {
  if (db.prepare('PRAGMA user_version').get().user_version >= 11) return;
  db.exec(`
  CREATE TABLE IF NOT EXISTS parcours (
    discord_id    TEXT PRIMARY KEY,
    pseudo        TEXT,
    nom           TEXT,
    etape         INTEGER NOT NULL DEFAULT 1,     -- 1 à 4, puis 5 = GOAT
    etape_depuis  TEXT NOT NULL,                  -- début de l'étape en cours (sert aux délais)
    niveau        TEXT,                           -- L1 ou L2
    compte_tiktok TEXT,
    niche         TEXT,
    pays          TEXT,
    entree_le     TEXT NOT NULL,
    fin_le        TEXT NOT NULL,                  -- fin des 90 jours
    etape1_le     TEXT,
    etape2_le     TEXT,
    etape3_le     TEXT,
    cree_le       TEXT NOT NULL,
    maj_le        TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS soumissions (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    discord_id     TEXT NOT NULL,
    etape          INTEGER NOT NULL,
    emplacement    TEXT NOT NULL,                 -- L1, L2 (étape 1) ; V1, V2, V3 (étape 3)
    etat           TEXT NOT NULL,                 -- brouillon, attente, corriger, valide
    note           INTEGER,
    retour_ia      TEXT,
    fichier        TEXT,
    type           TEXT,
    taille         INTEGER,
    envoye_le      TEXT,
    decide_le      TEXT,
    corriger_avant TEXT,
    cree_le        TEXT NOT NULL,
    UNIQUE (discord_id, emplacement)
  );
  CREATE TABLE IF NOT EXISTS remarques (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    discord_id    TEXT NOT NULL,
    soumission_id INTEGER,
    type          TEXT NOT NULL DEFAULT 'remarque', -- remarque, corriger, valide
    texte         TEXT NOT NULL,
    images        TEXT,                             -- JSON : noms des images jointes
    cree_le       TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS remarques_membre ON remarques(discord_id);
  CREATE TABLE IF NOT EXISTS seances_ponctuelles (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    discord_id TEXT NOT NULL,
    date       TEXT NOT NULL,
    heure      TEXT NOT NULL,
    type       TEXT NOT NULL DEFAULT 'entree',
    cree_le    TEXT NOT NULL,
    UNIQUE (date, heure)
  );
  PRAGMA user_version = 11;`);
}

// v12 : étape 4 (heures, publications, comptes rendus), objectifs et rôles à confirmer, activité et sinistres.
function migrerV12(db) {
  if (db.prepare('PRAGMA user_version').get().user_version >= 12) return;
  const c = colonnes(db, 'parcours');
  for (const [nom, type] of [['fuseau', 'TEXT'], ['heure_creation', 'TEXT'], ['heure_publication', 'TEXT'], ['heure_compte_rendu', 'TEXT'],
    ['derniere_activite', 'TEXT'], ['sinistres', 'INTEGER NOT NULL DEFAULT 0'], ['sinistre_depuis', 'TEXT'], ['sinistre_total', 'INTEGER NOT NULL DEFAULT 0']]) {
    if (!c.includes(nom)) db.exec(`ALTER TABLE parcours ADD COLUMN ${nom} ${type}`);
  }
  db.exec(`
  CREATE TABLE IF NOT EXISTS publications (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    discord_id TEXT NOT NULL,
    jour       TEXT NOT NULL,                  -- date locale du membre (AAAA-MM-JJ)
    lien       TEXT NOT NULL,
    cree_le    TEXT NOT NULL,
    UNIQUE (discord_id, lien)
  );
  CREATE INDEX IF NOT EXISTS publications_jour ON publications(discord_id, jour);
  CREATE TABLE IF NOT EXISTS captures_jour (
    discord_id TEXT NOT NULL,
    jour       TEXT NOT NULL,
    image      TEXT NOT NULL,                  -- capture du compte : preuve des publications du jour
    cree_le    TEXT NOT NULL,
    PRIMARY KEY (discord_id, jour)
  );
  CREATE TABLE IF NOT EXISTS comptes_rendus (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    discord_id      TEXT NOT NULL,
    jour            TEXT NOT NULL,             -- jour des publications dont on rend compte
    etat            TEXT NOT NULL,             -- attente, corriger, valide
    abonnes_total   INTEGER, vues_total INTEGER, abonnes_jour INTEGER, vues_jour INTEGER,
    pays_vues       TEXT, pays_abonnes TEXT,   -- JSON : top 3
    capture_revenus TEXT,
    question        TEXT,
    envoye_le       TEXT, decide_le TEXT, cree_le TEXT NOT NULL,
    UNIQUE (discord_id, jour)
  );
  CREATE TABLE IF NOT EXISTS stats_videos (
    compte_rendu_id INTEGER NOT NULL,
    publication_id  INTEGER NOT NULL,
    vues INTEGER, abonnes INTEGER, heure TEXT, visionnage_s INTEGER, retention_10s REAL, revenus REAL,
    PRIMARY KEY (compte_rendu_id, publication_id)
  );
  CREATE TABLE IF NOT EXISTS recompenses (
    discord_id  TEXT NOT NULL,
    role        TEXT NOT NULL,                 -- goat, 1500, 5000, 10000
    atteint_le  TEXT NOT NULL,
    confirme_le TEXT,
    PRIMARY KEY (discord_id, role)
  );
  CREATE TABLE IF NOT EXISTS sinistres (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    discord_id        TEXT NOT NULL,
    absent_depuis     TEXT NOT NULL,           -- dernière interaction avant le sinistre
    debut             TEXT NOT NULL,
    numero            INTEGER NOT NULL,        -- compteur atteint pendant cet épisode (1 à 3)
    etat              TEXT NOT NULL,           -- ouvert, fiche, precisions, rehabilite, retire
    fiche_pourquoi    TEXT, fiche_engagements TEXT, fiche_le TEXT,
    fin               TEXT,
    cree_le           TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS images_membres (
    nom        TEXT PRIMARY KEY,
    discord_id TEXT NOT NULL,
    cree_le    TEXT NOT NULL
  );
  PRAGMA user_version = 12;`);
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
  migrerV5(db);
  migrerV6(db);
  migrerV7(db);
  migrerV8(db);
  migrerV9(db);
  migrerV10(db);
  migrerV11(db);
  migrerV12(db);
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
