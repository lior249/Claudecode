// Le parcours de chaque membre de l'accompagnement, ses tickets et le suivi de l'Engagement.

const SCHEMA = `
  -- Un membre de l'accompagnement (rôle TikTok). status : active (il suit le parcours),
  -- exempt (Plugged®, Office ou admin : pas de parcours), left (il n'a plus le rôle TikTok).
  CREATE TABLE IF NOT EXISTS journey (
    user_id           TEXT PRIMARY KEY,
    status            TEXT NOT NULL DEFAULT 'active',
    stage             INTEGER NOT NULL DEFAULT 1,
    joined_at         INTEGER NOT NULL,
    -- Début du délai de 5 jours pour arriver à l'Engagement (remis à zéro à la sortie de prison).
    deadline_from     INTEGER NOT NULL,
    stage_since       INTEGER NOT NULL,
    full_name         TEXT,
    home_country      TEXT,
    level             TEXT,
    equipment         TEXT,
    availability      TEXT,
    watched_at        INTEGER,
    watched_days      INTEGER,
    watched_proof     TEXT,
    niche             TEXT,
    niche_type        TEXT,
    target_country    TEXT,
    cta_method        TEXT,
    positioned_at     INTEGER,
    videos            INTEGER NOT NULL DEFAULT 0,
    confirmed_at      INTEGER,
    confirmation_note TEXT,
    engagement_at     INTEGER,
    -- Engagement : jours de post (0 = dimanche, séparés par des virgules), heures de vérification
    -- (heure locale) et premier jour local où les rappels s'appliquent.
    post_days         TEXT,
    check1            INTEGER,
    check2            INTEGER,
    planning_from     TEXT,
    prison_count      INTEGER NOT NULL DEFAULT 0,
    fiche_message_id  TEXT,
    -- La fiche doit être republiée (1) : PlugBot la met à jour au tick suivant.
    fiche_dirty       INTEGER NOT NULL DEFAULT 1
  );

  -- Un ticket : un fil privé dans #parcours (une étape) ou dans #sortir-de-la-prison-interne (kind = sortie).
  CREATE TABLE IF NOT EXISTS journey_tickets (
    thread_id        TEXT PRIMARY KEY,
    user_id          TEXT NOT NULL,
    kind             TEXT NOT NULL,
    opened_at        INTEGER NOT NULL,
    closed_at        INTEGER,
    proof_message_id TEXT,
    last_alert_at    INTEGER
  );
  CREATE INDEX IF NOT EXISTS journey_tickets_by_user ON journey_tickets (user_id, kind);

  -- Ce que PlugBot a déjà envoyé pour un jour de post (date locale du membre).
  CREATE TABLE IF NOT EXISTS engagement_days (
    user_id TEXT NOT NULL,
    day     TEXT NOT NULL,
    morning INTEGER NOT NULL DEFAULT 0,
    check1  INTEGER NOT NULL DEFAULT 0,
    check2  INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (user_id, day)
  );
`;

const COLUMNS = {
  status: 'status',
  stage: 'stage',
  joinedAt: 'joined_at',
  deadlineFrom: 'deadline_from',
  stageSince: 'stage_since',
  fullName: 'full_name',
  homeCountry: 'home_country',
  level: 'level',
  equipment: 'equipment',
  availability: 'availability',
  watchedAt: 'watched_at',
  watchedDays: 'watched_days',
  watchedProof: 'watched_proof',
  niche: 'niche',
  nicheType: 'niche_type',
  targetCountry: 'target_country',
  ctaMethod: 'cta_method',
  positionedAt: 'positioned_at',
  videos: 'videos',
  confirmedAt: 'confirmed_at',
  confirmationNote: 'confirmation_note',
  engagementAt: 'engagement_at',
  postDays: 'post_days',
  check1: 'check1',
  check2: 'check2',
  planningFrom: 'planning_from',
  prisonCount: 'prison_count',
  ficheMessageId: 'fiche_message_id',
};

function toRecord(row) {
  if (!row) return null;
  const record = { userId: row.user_id };
  for (const [key, column] of Object.entries(COLUMNS)) record[key] = row[column];
  record.postDays = row.post_days ? row.post_days.split(',').map(Number) : [];
  return record;
}

function toTicket(row) {
  if (!row) return null;
  return {
    threadId: row.thread_id,
    userId: row.user_id,
    kind: row.kind,
    openedAt: row.opened_at,
    closedAt: row.closed_at,
    proofMessageId: row.proof_message_id,
    lastAlertAt: row.last_alert_at,
  };
}

export function createJourneyStore(connection) {
  connection.exec(SCHEMA);
  const statements = {
    get: connection.prepare('SELECT * FROM journey WHERE user_id = ?'),
    create: connection.prepare(
      'INSERT INTO journey (user_id, joined_at, deadline_from, stage_since, status, stage) VALUES (?, ?, ?, ?, ?, ?)',
    ),
    all: connection.prepare('SELECT * FROM journey ORDER BY joined_at'),
    active: connection.prepare("SELECT * FROM journey WHERE status = 'active' ORDER BY joined_at"),
    preEngagement: connection.prepare("SELECT user_id FROM journey WHERE status = 'active' AND stage < 4"),
    dirty: connection.prepare("SELECT * FROM journey WHERE fiche_dirty = 1 AND status != 'exempt' LIMIT ?"),
    markDirty: connection.prepare('UPDATE journey SET fiche_dirty = 1 WHERE user_id = ?'),
    markClean: connection.prepare('UPDATE journey SET fiche_dirty = 0, fiche_message_id = ? WHERE user_id = ?'),
    addTicket: connection.prepare('INSERT INTO journey_tickets (thread_id, user_id, kind, opened_at) VALUES (?, ?, ?, ?)'),
    ticket: connection.prepare('SELECT * FROM journey_tickets WHERE thread_id = ?'),
    ticketsOf: connection.prepare('SELECT * FROM journey_tickets WHERE user_id = ? ORDER BY opened_at'),
    lastTicket: connection.prepare('SELECT * FROM journey_tickets WHERE user_id = ? AND kind = ? ORDER BY opened_at DESC LIMIT 1'),
    closeTicket: connection.prepare('UPDATE journey_tickets SET closed_at = ? WHERE thread_id = ?'),
    setProof: connection.prepare('UPDATE journey_tickets SET proof_message_id = ? WHERE thread_id = ?'),
    setAlert: connection.prepare('UPDATE journey_tickets SET last_alert_at = ? WHERE thread_id = ?'),
    day: connection.prepare('SELECT * FROM engagement_days WHERE user_id = ? AND day = ?'),
    ensureDay: connection.prepare('INSERT OR IGNORE INTO engagement_days (user_id, day) VALUES (?, ?)'),
  };

  return {
    get(userId) {
      return toRecord(statements.get.get(userId));
    },
    create(userId, now, { status = 'active', stage = 1 } = {}) {
      statements.create.run(userId, now, now, now, status, stage);
      return toRecord(statements.get.get(userId));
    },
    // Met à jour les champs donnés. La fiche du membre sera republiée.
    update(userId, changes) {
      const entries = Object.entries(changes);
      if (entries.length === 0) return;
      const assignments = entries.map(([key]) => `${COLUMNS[key]} = ?`).join(', ');
      const values = entries.map(([key, value]) => (key === 'postDays' ? value.join(',') : value));
      connection.prepare(`UPDATE journey SET ${assignments}, fiche_dirty = 1 WHERE user_id = ?`).run(...values, userId);
    },
    all() {
      return statements.all.all().map(toRecord);
    },
    active() {
      return statements.active.all().map(toRecord);
    },
    // Membres qui suivent le parcours et ne sont pas encore à l'étape Engagement : la prison des
    // 15 jours sans show-up ne s'applique pas encore à eux.
    preEngagement() {
      return new Set(statements.preEngagement.all().map((row) => row.user_id));
    },
    dirtyFiches(limit) {
      return statements.dirty.all(limit).map(toRecord);
    },
    markDirty(userId) {
      statements.markDirty.run(userId);
    },
    ficheSaved(userId, messageId) {
      statements.markClean.run(messageId, userId);
    },

    addTicket(threadId, userId, kind, now) {
      statements.addTicket.run(threadId, userId, kind, now);
    },
    ticket(threadId) {
      return toTicket(statements.ticket.get(threadId));
    },
    ticketsOf(userId) {
      return statements.ticketsOf.all(userId).map(toTicket);
    },
    lastTicket(userId, kind) {
      return toTicket(statements.lastTicket.get(userId, kind));
    },
    closeTicket(threadId, now) {
      statements.closeTicket.run(now, threadId);
    },
    setProof(threadId, messageId) {
      statements.setProof.run(messageId, threadId);
    },
    setAlert(threadId, now) {
      statements.setAlert.run(now, threadId);
    },

    // Ce qui a déjà été envoyé ce jour local (morning, check1, check2 : 0 ou 1).
    day(userId, day) {
      statements.ensureDay.run(userId, day);
      return statements.day.get(userId, day);
    },
    markDay(userId, day, field) {
      statements.ensureDay.run(userId, day);
      connection.prepare(`UPDATE engagement_days SET ${field} = 1 WHERE user_id = ? AND day = ?`).run(userId, day);
    },
  };
}
