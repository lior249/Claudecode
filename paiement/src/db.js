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

// v13 : le total du tableau de bord TikTok (« Récompenses estimées », vue Par mois) recopié dans chaque compte rendu.
// Le gain du jour = ce total − le total précédent du même mois.
function migrerV13(db) {
  if (db.prepare('PRAGMA user_version').get().user_version >= 13) return;
  if (!colonnes(db, 'comptes_rendus').includes('total_mois')) db.exec('ALTER TABLE comptes_rendus ADD COLUMN total_mois REAL');
  db.exec('PRAGMA user_version = 13');
}

// v14 : coaching (livraison 3) : absences et imprévus du coach, séances touchées, coachings en réserve,
// fuseau horaire du membre ; une annulation par membre (et non plus une seule par créneau).
function migrerV14(db) {
  if (db.prepare('PRAGMA user_version').get().user_version >= 14) return;
  const c = colonnes(db, 'profils_coaching');
  if (!c.includes('reserves')) db.exec('ALTER TABLE profils_coaching ADD COLUMN reserves INTEGER NOT NULL DEFAULT 0');
  if (!c.includes('fuseau')) db.exec('ALTER TABLE profils_coaching ADD COLUMN fuseau TEXT');
  db.exec(`
  CREATE TABLE IF NOT EXISTS absences_coach (
    date    TEXT NOT NULL,
    heure   TEXT NOT NULL,
    type    TEXT NOT NULL DEFAULT 'absence',   -- absence (disponibilités de la semaine) | imprevu
    message TEXT,
    cree_le TEXT NOT NULL,
    PRIMARY KEY (date, heure)
  );
  CREATE TABLE IF NOT EXISTS seances_touchees (
    date       TEXT NOT NULL,
    heure      TEXT NOT NULL,
    discord_id TEXT NOT NULL,
    type       TEXT NOT NULL,                  -- absence | imprevu
    message    TEXT,
    credite    INTEGER NOT NULL DEFAULT 0,     -- 1 : un coaching en réserve a été donné
    choix      TEXT,                           -- NULL (à choisir) | reserve | reprogramme
    cree_le    TEXT NOT NULL,
    choisi_le  TEXT,
    PRIMARY KEY (date, heure)
  );
  CREATE TABLE IF NOT EXISTS disponibilites_coach (
    lundi     TEXT PRIMARY KEY,                -- semaine dont le coach a envoyé ses disponibilités
    envoye_le TEXT NOT NULL
  );
  CREATE TABLE annulations_v14 (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    discord_id    TEXT NOT NULL,
    date          TEXT NOT NULL,
    heure         TEXT NOT NULL,
    justification TEXT NOT NULL,
    cree_le       TEXT NOT NULL,
    UNIQUE (date, heure, discord_id)
  );
  INSERT INTO annulations_v14 (id, discord_id, date, heure, justification, cree_le)
    SELECT id, discord_id, date, heure, justification, cree_le FROM annulations;
  DROP TABLE annulations;
  ALTER TABLE annulations_v14 RENAME TO annulations;
  PRAGMA user_version = 14;`);
}

// v15 : l'application Overmaxx (notifications web) : réglages (clés VAPID), appareils abonnés,
// choix Bob ou application, rappels de paiement envoyés dans l'application 10 minutes après Bob.
function migrerV15(db) {
  if (db.prepare('PRAGMA user_version').get().user_version >= 15) return;
  db.exec(`
  CREATE TABLE IF NOT EXISTS reglages (
    cle    TEXT PRIMARY KEY,
    valeur TEXT NOT NULL,
    maj_le TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS abonnements_push (
    endpoint   TEXT PRIMARY KEY,
    discord_id TEXT NOT NULL,
    p256dh     TEXT NOT NULL,
    auth       TEXT NOT NULL,
    appareil   TEXT,
    erreurs    INTEGER NOT NULL DEFAULT 0,
    cree_le    TEXT NOT NULL,
    vu_le      TEXT
  );
  CREATE INDEX IF NOT EXISTS abonnements_push_membre ON abonnements_push(discord_id);
  CREATE TABLE IF NOT EXISTS preferences_notif (
    discord_id TEXT PRIMARY KEY,
    canal      TEXT NOT NULL DEFAULT 'bob',   -- bob | app
    maj_le     TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS notifications_differees (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    discord_id    TEXT NOT NULL,
    titre         TEXT NOT NULL,
    corps         TEXT NOT NULL,
    url           TEXT,
    membre_id     INTEGER,                    -- rappel de paiement : annulé si son accès a été prolongé entre-temps
    acces_avant   TEXT,
    envoyer_apres TEXT NOT NULL,
    envoye_le     TEXT,
    resultat      TEXT,
    cree_le       TEXT NOT NULL
  );
  PRAGMA user_version = 15;`);
}

// v16 : tableau des élèves : étapes passées à la main par le coach (sans validation sur la plateforme).
function migrerV16(db) {
  if (db.prepare('PRAGMA user_version').get().user_version >= 16) return;
  if (!colonnes(db, 'parcours').includes('etapes_forcees')) db.exec('ALTER TABLE parcours ADD COLUMN etapes_forcees TEXT');
  db.exec('PRAGMA user_version = 16');
}

// v17 : accueil des nouveaux membres (prénom, pays, fuseau, accueil terminé).
function migrerV17(db) {
  if (db.prepare('PRAGMA user_version').get().user_version >= 17) return;
  db.exec(`CREATE TABLE IF NOT EXISTS profils_membres (
    discord_id      TEXT PRIMARY KEY,
    prenom          TEXT,
    pays            TEXT,
    fuseau          TEXT,
    accueil_fini_le TEXT,
    maj_le          TEXT NOT NULL
  );
  PRAGMA user_version = 17;`);
}

// v18 : photo de profil Discord du membre (classement).
function migrerV18(db) {
  if (db.prepare('PRAGMA user_version').get().user_version >= 18) return;
  if (!colonnes(db, 'profils_membres').includes('avatar')) db.exec('ALTER TABLE profils_membres ADD COLUMN avatar TEXT');
  db.exec('PRAGMA user_version = 18');
}

// v19 : rôles donnés à la main. Bob demande au coach s'il ouvre le site à ce membre (Oui / Non).
// abonnes_carte.source : 'whop' (rôle donné par le bot de Whop), 'main' (accès validé par le coach), NULL (repéré avant la validation).
// parcours.retire_le : parcours Elite fermé (accès refusé) ; il reste lisible, et revient si l'accès est rouvert.
function migrerV19(db) {
  if (db.prepare('PRAGMA user_version').get().user_version >= 19) return;
  if (!colonnes(db, 'abonnes_carte').includes('source')) db.exec('ALTER TABLE abonnes_carte ADD COLUMN source TEXT');
  if (!colonnes(db, 'parcours').includes('retire_le')) db.exec('ALTER TABLE parcours ADD COLUMN retire_le TEXT');
  db.exec(`
  CREATE TABLE IF NOT EXISTS acces_manuels (
    discord_id  TEXT NOT NULL,
    programme   TEXT NOT NULL,
    pseudo      TEXT,
    statut      TEXT NOT NULL DEFAULT 'attente',  -- attente | accorde | refuse
    ancien      INTEGER NOT NULL DEFAULT 0,       -- 1 : avait déjà accès au site avant la validation (il le garde en attendant)
    donne_par   TEXT,                             -- qui a donné le rôle (journal d'audit du serveur), si connu
    demande_le  TEXT NOT NULL,
    prevenu_le  TEXT,                             -- question envoyée au coach par Bob
    decide_le   TEXT,
    PRIMARY KEY (discord_id, programme)
  );
  INSERT OR IGNORE INTO acces_manuels (discord_id, programme, pseudo, statut, ancien, demande_le)
    SELECT discord_id, programme, pseudo, 'attente', 1, strftime('%Y-%m-%dT%H:%M:%fZ', 'now') FROM abonnes_carte WHERE termine_le IS NULL AND perdu_le IS NULL;
  PRAGMA user_version = 19;`);
}

// v20 : communauté des élèves Elite. Suivis (10 places) et concurrences (3 au plus, invitation acceptée ou refusée).
function migrerV20(db) {
  if (db.prepare('PRAGMA user_version').get().user_version >= 20) return;
  db.exec(`
  CREATE TABLE IF NOT EXISTS suivis (
    suiveur  TEXT NOT NULL,
    suivi    TEXT NOT NULL,
    type     TEXT NOT NULL DEFAULT 'suivi',   -- suivi | concurrent
    cree_le  TEXT NOT NULL,
    PRIMARY KEY (suiveur, suivi)
  );
  CREATE INDEX IF NOT EXISTS suivis_suivi ON suivis(suivi);
  CREATE TABLE IF NOT EXISTS concurrences (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    de        TEXT NOT NULL,
    vers      TEXT NOT NULL,
    objectif  REAL NOT NULL,                  -- palier de revenus ($) : le premier qui l'atteint gagne
    statut    TEXT NOT NULL,                  -- attente | accepte | refuse | abandon | fini
    gagnant   TEXT,
    cree_le   TEXT NOT NULL, decide_le TEXT, fini_le TEXT
  );
  PRAGMA user_version = 20;`);
}

// v21 : espace notifications du coach. Journal des messages de Bob (lu / non lu) et rappels qu'il se crée lui-même.
function migrerV21(db) {
  if (db.prepare('PRAGMA user_version').get().user_version >= 21) return;
  db.exec(`
  CREATE TABLE IF NOT EXISTS notifications_admin (
    id      INTEGER PRIMARY KEY AUTOINCREMENT,
    texte   TEXT NOT NULL,
    lien    TEXT,                             -- page du site à ouvrir (chemin), si le message avait un bouton
    cree_le TEXT NOT NULL,
    lu_le   TEXT
  );
  CREATE TABLE IF NOT EXISTS rappels_admin (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    texte         TEXT NOT NULL,
    frequence     TEXT NOT NULL,              -- une-fois | jour | semaine
    jours         TEXT,                       -- semaine : 0 (dimanche) à 6, séparés par des virgules
    date          TEXT,                       -- une-fois : AAAA-MM-JJ
    heure         TEXT NOT NULL,              -- HH:MM, heure GMT
    actif         INTEGER NOT NULL DEFAULT 1,
    dernier_envoi TEXT,
    cree_le       TEXT NOT NULL
  );
  PRAGMA user_version = 21;`);
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
  migrerV13(db);
  migrerV14(db);
  migrerV15(db);
  migrerV16(db);
  migrerV17(db);
  migrerV18(db);
  migrerV19(db);
  migrerV20(db);
  migrerV21(db);
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
