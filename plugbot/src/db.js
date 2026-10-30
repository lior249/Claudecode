// Base de données SQLite (un simple fichier). Utilise le module SQLite intégré à Node.js.

import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { DAY_MS } from './time.js';

const SCHEMA = `
  -- Un show-up par message posté dans #flex-resultats.
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

  -- Membres en prison : dernier palier annoncé, rôle Prisonnier donné ou non,
  -- rôles de récompense mis de côté pendant la prison (séparés par des virgules),
  -- et prison interne (1 : membre du parcours de l'accompagnement, il sort seulement par un ticket).
  CREATE TABLE IF NOT EXISTS prison (
    user_id         TEXT PRIMARY KEY,
    level           INTEGER NOT NULL,
    has_role        INTEGER NOT NULL DEFAULT 0,
    suspended_roles TEXT NOT NULL DEFAULT '',
    internal        INTEGER NOT NULL DEFAULT 0
  );

  -- Catégorie de chaque membre (free, plug, ou NULL s'il n'a plus de rôle suivi),
  -- et dernier jour où le compteur de la prison a été remis à zéro (numéro du jour UTC) :
  -- changement de rôle ou libération par l'équipe.
  CREATE TABLE IF NOT EXISTS members (
    user_id   TEXT PRIMARY KEY,
    category  TEXT,
    reset_day INTEGER
  );

  -- Messages à envoyer plus tard (par exemple au gagnant, 3 minutes après la clôture).
  -- channel : nom du salon dans les réglages ; notify : membres notifiés, séparés par des virgules.
  CREATE TABLE IF NOT EXISTS scheduled (
    id      INTEGER PRIMARY KEY AUTOINCREMENT,
    channel TEXT NOT NULL,
    content TEXT NOT NULL,
    notify  TEXT NOT NULL DEFAULT '',
    send_at INTEGER NOT NULL
  );

  -- Réglages internes : date de lancement, dernier message lu, dernières publications,
  -- messages des classements en direct.
  CREATE TABLE IF NOT EXISTS meta (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
`;

export function openDatabase(path) {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  // Si la base est occupée un instant, attendre jusqu'à 5 secondes au lieu d'échouer.
  db.exec('PRAGMA busy_timeout = 5000;');
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec(SCHEMA);
  // Colonnes ajoutées après coup : ajoutées aussi aux bases existantes.
  const prisonColumns = new Set(db.prepare('PRAGMA table_info(prison)').all().map((column) => column.name));
  if (!prisonColumns.has('internal')) db.exec('ALTER TABLE prison ADD COLUMN internal INTEGER NOT NULL DEFAULT 0');

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
    firstShowupBetween: db.prepare(
      "SELECT MIN(created_at) AS first FROM showups WHERE status = 'valid' AND user_id = ? AND created_at >= ? AND created_at < ?",
    ),
    validDays: db.prepare(`SELECT DISTINCT user_id, created_at / ${DAY_MS} AS day FROM showups WHERE status = 'valid'`),
    prisonRecords: db.prepare('SELECT * FROM prison'),
    getPrison: db.prepare('SELECT * FROM prison WHERE user_id = ?'),
    addPrison: db.prepare('INSERT OR REPLACE INTO prison (user_id, level, suspended_roles, internal) VALUES (?, ?, ?, ?)'),
    setPrisonLevel: db.prepare('UPDATE prison SET level = ? WHERE user_id = ?'),
    markPrisonRole: db.prepare('UPDATE prison SET has_role = 1 WHERE user_id = ?'),
    removePrison: db.prepare('DELETE FROM prison WHERE user_id = ?'),
    schedule: db.prepare('INSERT INTO scheduled (channel, content, notify, send_at) VALUES (?, ?, ?, ?)'),
    dueMessages: db.prepare('SELECT * FROM scheduled WHERE send_at <= ? ORDER BY send_at, id'),
    removeScheduled: db.prepare('DELETE FROM scheduled WHERE id = ?'),
    memberStates: db.prepare('SELECT * FROM members'),
    getMemberState: db.prepare('SELECT * FROM members WHERE user_id = ?'),
    setMemberState: db.prepare('INSERT OR REPLACE INTO members (user_id, category, reset_day) VALUES (?, ?, ?)'),
    setResetDay: db.prepare(
      'INSERT INTO members (user_id, reset_day) VALUES (?, ?) ON CONFLICT (user_id) DO UPDATE SET reset_day = excluded.reset_day',
    ),
  };

  function prisonRecord(row) {
    return {
      level: row.level,
      hasRole: row.has_role === 1,
      suspendedRoles: row.suspended_roles ? row.suspended_roles.split(',') : [],
      internal: row.internal === 1,
    };
  }

  function memberState(row) {
    return { category: row.category, resetDay: row.reset_day };
  }

  function countsMap(rows) {
    return new Map(rows.map((row) => [row.user_id, { count: row.count, reachedAt: row.reached_at }]));
  }

  return {
    // La connexion SQLite elle-même, pour les modules qui ont leurs propres tables (événements).
    connection: db,

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
    // Heure du premier show-up du membre entre start et end, ou null.
    firstShowupBetween(userId, start, end) {
      return statements.firstShowupBetween.get(userId, start, end).first ?? null;
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

    prisonRecords() {
      return new Map(statements.prisonRecords.all().map((row) => [row.user_id, prisonRecord(row)]));
    },
    getPrison(userId) {
      const row = statements.getPrison.get(userId);
      return row ? prisonRecord(row) : null;
    },
    addPrison(userId, level, suspendedRoles, internal = false) {
      statements.addPrison.run(userId, level, suspendedRoles.join(','), internal ? 1 : 0);
    },
    setPrisonLevel(userId, level) {
      statements.setPrisonLevel.run(level, userId);
    },
    markPrisonRole(userId) {
      statements.markPrisonRole.run(userId);
    },
    removePrison(userId) {
      statements.removePrison.run(userId);
    },

    schedule(channel, content, notifiedUserIds, sendAt) {
      statements.schedule.run(channel, content, notifiedUserIds.join(','), sendAt);
    },
    dueMessages(now) {
      return statements.dueMessages.all(now).map((row) => ({
        id: row.id,
        channel: row.channel,
        content: row.content,
        notify: row.notify ? row.notify.split(',') : [],
      }));
    },
    removeScheduled(id) {
      statements.removeScheduled.run(id);
    },

    memberStates() {
      return new Map(statements.memberStates.all().map((row) => [row.user_id, memberState(row)]));
    },
    getMemberState(userId) {
      const row = statements.getMemberState.get(userId);
      return row ? memberState(row) : null;
    },
    setMemberState(userId, category, resetDay) {
      statements.setMemberState.run(userId, category, resetDay);
    },
    setResetDay(userId, day) {
      statements.setResetDay.run(userId, day);
    },

    close() {
      db.close();
    },
  };
}
