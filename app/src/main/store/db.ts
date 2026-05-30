import Database from 'better-sqlite3';

export const MIGRATIONS: { version: number; sql: string }[] = [
  {
    version: 1,
    sql: `
      CREATE TABLE goals (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT,
        deadline TEXT,
        status TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE tasks (
        id TEXT PRIMARY KEY,
        goal_id TEXT NOT NULL REFERENCES goals(id),
        title TEXT NOT NULL,
        estimate_minutes INTEGER NOT NULL,
        depends_on TEXT,
        scheduled_start TEXT,
        scheduled_end TEXT,
        calendar_event_id TEXT,
        status TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE sessions (
        id TEXT PRIMARY KEY,
        task_id TEXT REFERENCES tasks(id) ON DELETE SET NULL,
        started_at TEXT,
        ended_at TEXT
      );

      CREATE TABLE activity (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ts TEXT,
        kind TEXT,
        payload TEXT
      );

      CREATE TABLE summaries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        task_id TEXT REFERENCES tasks(id) ON DELETE SET NULL,
        ts TEXT,
        summary TEXT,
        signal REAL
      );

      CREATE INDEX idx_tasks_goal_id ON tasks(goal_id);
      CREATE INDEX idx_tasks_scheduled_start ON tasks(scheduled_start);
    `,
  },
  {
    version: 2,
    sql: `
      CREATE TABLE settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
      INSERT INTO settings (key, value) VALUES ('googleConnected', 'false');
      INSERT INTO settings (key, value) VALUES ('workingHours', '{"start":"09:00","end":"18:00"}');
      INSERT INTO settings (key, value) VALUES ('horizonDays', '14');
      INSERT INTO settings (key, value) VALUES ('pauseScheduling', 'false');
    `,
  },
];

export function runMigrations(db: Database.Database): void {
  db.prepare(
    `
    CREATE TABLE IF NOT EXISTS _migrations (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL
    )
  `,
  ).run();

  const row = db.prepare('SELECT MAX(version) as current_version FROM _migrations').get() as
    | { current_version: number | null }
    | undefined;
  const currentVersion = row?.current_version ?? 0;

  const maxAvailableVersion =
    MIGRATIONS.length > 0 ? Math.max(...MIGRATIONS.map((m) => m.version)) : 0;
  if (currentVersion > maxAvailableVersion) {
    throw new Error(
      `Database version (${currentVersion}) is newer than the supported code version (${maxAvailableVersion}). Refusing to downgrade.`,
    );
  }

  const pending = MIGRATIONS.filter((m) => m.version > currentVersion).sort(
    (a, b) => a.version - b.version,
  );

  if (pending.length === 0) {
    return;
  }

  const executeTransaction = db.transaction(() => {
    for (const migration of pending) {
      db.exec(migration.sql);
      db.prepare('INSERT INTO _migrations (version, applied_at) VALUES (?, ?)').run(
        migration.version,
        new Date().toISOString(),
      );
    }
  });

  executeTransaction();
}

export function initDb(path: string): Database.Database {
  const db = new Database(path);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  runMigrations(db);
  return db;
}
