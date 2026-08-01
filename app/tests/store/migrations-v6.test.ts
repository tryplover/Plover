import { describe, it, expect } from 'vitest';
import Database from 'better-sqlite3';
import { runMigrations } from '../../src/main/store/db';

describe('migration v6 — summaries attribution columns', () => {
  it('adds source/progress_delta/previous_status/corrected with correct defaults', () => {
    const db = new Database(':memory:');
    runMigrations(db);

    db.prepare(
      `INSERT INTO goals (id, title, description, deadline, status, created_at, updated_at)
       VALUES ('g1', 'g', '', null, 'active', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z')`,
    ).run();
    db.prepare(
      `INSERT INTO tasks (id, goal_id, title, estimate_minutes, status, sort_index, created_at, updated_at)
       VALUES ('t1', 'g1', 'task', 30, 'todo', 0, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z')`,
    ).run();
    db.prepare(
      `INSERT INTO summaries (task_id, ts, summary, signal, source, progress_delta, previous_status)
       VALUES ('t1', '2026-01-01T00:00:00.000Z', 's', 0.5, 'inference', 25, 'todo')`,
    ).run();

    const row = db.prepare(`SELECT * FROM summaries WHERE task_id = 't1'`).get() as {
      source: string;
      progress_delta: number;
      previous_status: string;
      corrected: number;
    };
    expect(row.source).toBe('inference');
    expect(row.progress_delta).toBe(25);
    expect(row.previous_status).toBe('todo');
    expect(row.corrected).toBe(0);

    const maxVersionRow = db.prepare('SELECT MAX(version) as v FROM _migrations').get() as
      | { v: number }
      | undefined;
    expect(maxVersionRow?.v).toBe(6);
  });
});
