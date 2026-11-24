'use strict';

const fs = require('fs');
const path = require('path');

// SQLite intégré à Node (>= 22.13). Un seul fichier : pense à le mettre sur un volume persistant.
function ouvrirBase(fichier) {
  // Masque l'avertissement « expérimental » de node:sqlite, sans toucher aux autres avertissements.
  const emettre = process.emitWarning;
  process.emitWarning = (w, ...r) => (String(w).includes('SQLite') ? undefined : emettre.call(process, w, ...r));
  const { DatabaseSync } = require('node:sqlite');
  process.emitWarning = emettre;

  if (fichier !== ':memory:') fs.mkdirSync(path.dirname(path.resolve(fichier)), { recursive: true });
  const db = new DatabaseSync(fichier);
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA busy_timeout = 5000;

    CREATE TABLE IF NOT EXISTS membres (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      email           TEXT NOT NULL UNIQUE,      -- email du compte Whop
      nom             TEXT NOT NULL,
      telephone       TEXT,
      discord_id      TEXT,                      -- rempli plus tard par le bot
      code_promo      TEXT,                      -- code Whop d'inscription
      acces_jusqu_au  TEXT NOT NULL,             -- ISO 8601 : fin de l'accès payé
      cree_le         TEXT NOT NULL,
      maj_le          TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS commandes (
      ref               TEXT PRIMARY KEY,        -- identifiant aléatoire, sert dans les URL
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
      cree_le           TEXT NOT NULL,
      payee_le          TEXT
    );
    CREATE INDEX IF NOT EXISTS commandes_email ON commandes(email);
  `);
  return db;
}

module.exports = { ouvrirBase };
