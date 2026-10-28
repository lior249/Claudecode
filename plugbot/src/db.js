// Base de données SQLite (un simple fichier). Utilise le module SQLite intégré à Node.js.

import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { DAY_MS } from './time.js';

const SCHEMA = `
  -- Un show-up par message posté dans #résultats.
  -- status : valid (compté), rejected (retiré par un admin), deleted (message supprimé).
  CREATE TABLE IF NOT EXISTS showups (
    message_id TEXT PRIMARY KEY,
    user_id    TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    status     TEXT NOT NULL DEFAULT 'valid',
    changed_by TEXT
  );
  CREATE INDEX IF NOT EXISTS showups_by_user ON showups (user_id, created_at);
  CREATE INDEX IF NOT EXISTS showups_by_date ON showups (created_at);

  -- Membres annoncés en prison, avec le dernier palier annoncé.
  CREATE TABLE IF NOT EXISTS prison (
    user_id TEXT PRIMARY KEY,
    level   INTEGER NOT NULL
  );

  -- Réglages internes : date de lancement, dernier message lu, dernières publications.
  CREATE TABLE IF NOT EXISTS meta (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
`;

export function openDatabase(path) {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec(SCHEMA);

  const statements = {
    getMeta: db.prepare('SELECT value FROM meta WHERE key = ?'),
    setMeta: db.prepare('INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value'),
    addShowup: db.prepare('INSERT OR IGNORE INTO showups (message_id, user_id, created_at) VALUES (?, ?, ?)'),
    getShowup: db.prepare('SELECT * FROM showups WHERE message_id = ?'),
    setStatus: db.prepare('UPDATE showups SET status = ?, changed_by = ? WHERE message_id = ?'),
    showupsSince: db.prepare("SELECT * FROM showups WHERE created_at >= ? AND status != 'deleted' ORDER BY created_at"),
    totals: db.prepare(
      "SELECT user_id, COUNT(*) AS count, MAX(created_at) AS reached_at FROM showups WHERE status = 'valid' GROUP BY user_id",
    ),
    countsBetween: db.prepare(
      `SELECT user_id, COUNT(*) AS count, MAX(created_at) AS reached_at FROM showups
       WHERE status = 'valid' AND created_at >= ? AND created_at < ? GROUP BY user_id`,
    ),
    userCount: db.prepare("SELECT COUNT(*) AS count FROM showups WHERE status = 'valid' AND user_id = ?"),
    userCountBetween: db.prepare(
      "SELECT COUNT(*) AS count FROM showups WHERE status = 'valid' AND user_id = ? AND created_at >= ? AND created_at < ?",
    ),
    validDays: db.prepare(`SELECT DISTINCT user_id, created_at / ${DAY_MS} AS day FROM showups WHERE status = 'valid'`),
    prisonLevels: db.prepare('SELECT user_id, level FROM prison'),
    getPrisonLevel: db.prepare('SELECT level FROM prison WHERE user_id = ?'),
    setPrisonLevel: db.prepare(
      'INSERT INTO prison (user_id, level) VALUES (?, ?) ON CONFLICT (user_id) DO UPDATE SET level = excluded.level',
    ),
    removePrison: db.prepare('DELETE FROM prison WHERE user_id = ?'),
  };

  function countsMap(rows) {
    return new Map(rows.map((row) => [row.user_id, { count: row.count, reachedAt: row.reached_at }]));
  }

  return {
    getMeta(key) {
      return statements.getMeta.get(key)?.value ?? null;
    },
    setMeta(key, value) {
      statements.setMeta.run(key, String(value));
    },

    // Renvoie false si ce message était déjà enregistré.
    addShowup(messageId, userId, createdAt) {
      return statements.addShowup.run(messageId, userId, createdAt).changes > 0;
    },
    getShowup(messageId) {
      return statements.getShowup.get(messageId) ?? null;
    },
    setStatus(messageId, status, changedBy = null) {
      statements.setStatus.run(status, changedBy, messageId);
    },
    showupsSince(timestamp) {
      return statements.showupsSince.all(timestamp);
    },

    totals() {
      return countsMap(statements.totals.all());
    },
    countsBetween(start, end) {
      return countsMap(statements.countsBetween.all(start, end));
    },
    userTotals(userId, { start, end }) {
      return {
        total: statements.userCount.get(userId).count,
        week: statements.userCountBetween.get(userId, start, end).count,
      };
    },
    // Jours avec au moins un show-up, par membre.
    validDays() {
      const days = new Map();
      for (const row of statements.validDays.all()) {
        if (!days.has(row.user_id)) days.set(row.user_id, new Set());
        days.get(row.user_id).add(row.day);
      }
      return days;
    },

    prisonLevels() {
      return new Map(statements.prisonLevels.all().map((row) => [row.user_id, row.level]));
    },
    getPrisonLevel(userId) {
      return statements.getPrisonLevel.get(userId)?.level ?? null;
    },
    setPrisonLevel(userId, level) {
      statements.setPrisonLevel.run(userId, level);
    },
    removePrison(userId) {
      statements.removePrison.run(userId);
    },

    close() {
      db.close();
    },
  };
}
