// Les événements planifiés et leurs rappels, dans la même base que le reste de PlugBot.

const SCHEMA = `
  -- Un événement par ticket. status : draft (brouillon), scheduled (validé), cancelled, done (terminé).
  -- roles et reminders : listes séparées par des virgules (everyone,free,plug / creation,7d,3d,24h,3h).
  CREATE TABLE IF NOT EXISTS events (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    type                TEXT NOT NULL,
    audience            TEXT,
    title               TEXT,
    start_at            INTEGER,
    duration_min        INTEGER NOT NULL DEFAULT 60,
    details             TEXT NOT NULL DEFAULT '',
    template            INTEGER NOT NULL DEFAULT 0,
    location_channel    TEXT,
    location_url        TEXT,
    roles               TEXT NOT NULL DEFAULT '',
    reminders           TEXT NOT NULL DEFAULT 'creation,7d,3d,24h,3h',
    status              TEXT NOT NULL DEFAULT 'draft',
    thread_id           TEXT,
    settings_message_id TEXT,
    control_message_id  TEXT,
    discord_event_id    TEXT,
    announced           INTEGER NOT NULL DEFAULT 0,
    created_at          INTEGER NOT NULL,
    -- Message du ticket qui contient l'image de couverture (l'admin l'envoie dans le fil).
    cover_message_id    TEXT
  );

  -- Rappels programmés (7d, 3d, 24h, 3h, feedback). Ils sont rédigés au moment de l'envoi.
  CREATE TABLE IF NOT EXISTS event_reminders (
    event_id INTEGER NOT NULL,
    kind     TEXT NOT NULL,
    send_at  INTEGER NOT NULL,
    PRIMARY KEY (event_id, kind)
  );
`;

const COLUMNS = {
  type: 'type',
  audience: 'audience',
  title: 'title',
  startAt: 'start_at',
  durationMin: 'duration_min',
  details: 'details',
  template: 'template',
  locationChannel: 'location_channel',
  locationUrl: 'location_url',
  roles: 'roles',
  reminders: 'reminders',
  status: 'status',
  threadId: 'thread_id',
  settingsMessageId: 'settings_message_id',
  controlMessageId: 'control_message_id',
  discordEventId: 'discord_event_id',
  announced: 'announced',
  coverMessageId: 'cover_message_id',
};

// Colonnes ajoutées après la création de la table : ajoutées aussi aux bases existantes.
const ADDED_COLUMNS = { cover_message_id: 'TEXT' };

const LISTS = new Set(['roles', 'reminders']);

function toEvent(row) {
  if (!row) return null;
  const event = { id: row.id, createdAt: row.created_at };
  for (const [key, column] of Object.entries(COLUMNS)) {
    const value = row[column];
    event[key] = LISTS.has(key) ? (value ? value.split(',') : []) : value;
  }
  event.announced = row.announced === 1;
  return event;
}

export function createEventStore(connection) {
  connection.exec(SCHEMA);
  const existing = new Set(connection.prepare('PRAGMA table_info(events)').all().map((column) => column.name));
  for (const [column, type] of Object.entries(ADDED_COLUMNS)) {
    if (!existing.has(column)) connection.exec(`ALTER TABLE events ADD COLUMN ${column} ${type}`);
  }
  const statements = {
    create: connection.prepare('INSERT INTO events (type, audience, created_at) VALUES (?, ?, ?)'),
    get: connection.prepare('SELECT * FROM events WHERE id = ?'),
    byThread: connection.prepare('SELECT * FROM events WHERE thread_id = ?'),
    upcoming: connection.prepare("SELECT * FROM events WHERE status = 'scheduled' ORDER BY start_at"),
    endedBefore: connection.prepare(
      "SELECT * FROM events WHERE status = 'scheduled' AND start_at + duration_min * 60000 <= ? ORDER BY start_at",
    ),
    addReminder: connection.prepare('INSERT OR REPLACE INTO event_reminders (event_id, kind, send_at) VALUES (?, ?, ?)'),
    clearReminders: connection.prepare('DELETE FROM event_reminders WHERE event_id = ?'),
    dueReminders: connection.prepare('SELECT * FROM event_reminders WHERE send_at <= ? ORDER BY send_at'),
    removeReminder: connection.prepare('DELETE FROM event_reminders WHERE event_id = ? AND kind = ?'),
    remindersOf: connection.prepare('SELECT * FROM event_reminders WHERE event_id = ? ORDER BY send_at'),
  };

  return {
    create(type, audience, now) {
      const { lastInsertRowid } = statements.create.run(type, audience, now);
      return toEvent(statements.get.get(Number(lastInsertRowid)));
    },
    get(id) {
      return toEvent(statements.get.get(id));
    },
    byThread(threadId) {
      return toEvent(statements.byThread.get(threadId));
    },
    // Met à jour les champs donnés, par exemple { title: 'Masterclass', startAt: … }.
    update(id, changes) {
      const entries = Object.entries(changes);
      if (entries.length === 0) return;
      const assignments = entries.map(([key]) => `${COLUMNS[key]} = ?`).join(', ');
      const values = entries.map(([key, value]) => {
        if (LISTS.has(key)) return value.join(',');
        if (key === 'announced') return value ? 1 : 0;
        return value;
      });
      connection.prepare(`UPDATE events SET ${assignments} WHERE id = ?`).run(...values, id);
    },
    upcoming() {
      return statements.upcoming.all().map(toEvent);
    },
    endedBefore(now) {
      return statements.endedBefore.all(now).map(toEvent);
    },
    setReminders(eventId, reminders) {
      statements.clearReminders.run(eventId);
      for (const { kind, sendAt } of reminders) statements.addReminder.run(eventId, kind, sendAt);
    },
    clearReminders(eventId) {
      statements.clearReminders.run(eventId);
    },
    dueReminders(now) {
      return statements.dueReminders.all(now).map((row) => ({ eventId: row.event_id, kind: row.kind, sendAt: row.send_at }));
    },
    removeReminder(eventId, kind) {
      statements.removeReminder.run(eventId, kind);
    },
    remindersOf(eventId) {
      return statements.remindersOf.all(eventId).map((row) => ({ kind: row.kind, sendAt: row.send_at }));
    },
  };
}
