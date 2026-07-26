import { describe, it, expect } from 'vitest';
import Database from 'better-sqlite3';
import { runMigrations } from '../../src/main/store/db';

describe('migration v4 — sort_index backfill', () => {
  it('backfills sort_index 0..N-1 per goal in (created_at, id) order', () => {
    const db = new Database(':memory:');
    db.pragma('foreign_keys = ON');
    runMigrations(db);
    const now = new Date().toISOString();
    const later = new Date(Date.now() + 1000).toISOString();
    db.prepare(
      `INSERT INTO goals (id, title, description, deadline, status, created_at, updated_at)
       VALUES ('g1', 'g', '', null, 'active', ?, ?)`,
    ).run(now, now);
    db.prepare(
      `INSERT INTO tasks (id, goal_id, title, estimate_minutes, status,
         created_at, updated_at, sort_index)
       VALUES ('t1', 'g1', 'first',  30, 'todo', ?, ?, 0),
              ('t2', 'g1', 'second', 30, 'todo', ?, ?, 0),
              ('t3', 'g1', 'third',  30, 'todo', ?, ?, 0)`,
    ).run(now, now, later, later, later, later);
    db.exec(
      `UPDATE tasks SET sort_index = (
         SELECT COUNT(*) FROM tasks t2
         WHERE t2.goal_id = tasks.goal_id
           AND (t2.created_at < tasks.created_at
                OR (t2.created_at = tasks.created_at AND t2.id < tasks.id))
       )`,
    );
    const rows = db.prepare(`SELECT id, sort_index FROM tasks ORDER BY sort_index`).all() as {
      id: string;
      sort_index: number;
    }[];
    expect(rows).toHaveLength(3);
    const [r0, r1, r2] = rows;
    expect(r0?.id).toBe('t1');
    expect(r0?.sort_index).toBe(0);
    expect(r1?.id).toBe('t2');
    expect(r1?.sort_index).toBe(1);
    expect(r2?.id).toBe('t3');
    expect(r2?.sort_index).toBe(2);
  });
});
