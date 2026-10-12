import { describe, expect, it, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { runMigrations } from '@main/store/db.js';
import { SessionsRepo } from '@main/store/repos/sessions.js';

describe('SessionsRepo pomodoro columns', () => {
  let db: Database.Database;
  let repo: SessionsRepo;

  beforeEach(() => {
    db = new Database(':memory:');
    runMigrations(db);
    repo = new SessionsRepo(db);
  });

  it('defaults to a work phase with no planned length', () => {
    const created = repo.create({
      task_id: null,
      started_at: '2026-10-12T10:00:00.000Z',
      ended_at: null,
    });
    expect(created.phase).toBe('work');
    expect(created.planned_seconds).toBeNull();
    expect(repo.get(created.id)).toEqual(created);
  });

  it('persists explicit phase and planned_seconds', () => {
    const created = repo.create({
      task_id: null,
      started_at: '2026-10-12T10:00:00.000Z',
      ended_at: '2026-10-12T10:25:00.000Z',
      phase: 'longBreak',
      planned_seconds: 900,
    });
    expect(repo.get(created.id)).toMatchObject({ phase: 'longBreak', planned_seconds: 900 });
  });

  it('updates planned_seconds, including back to null, without touching other fields', () => {
    const created = repo.create({
      task_id: null,
      started_at: '2026-10-12T10:00:00.000Z',
      ended_at: null,
      planned_seconds: 1500,
    });
    const updated = repo.update(created.id, { planned_seconds: null });
    expect(updated).toEqual({ ...created, planned_seconds: null });
    expect(repo.get(created.id)).toEqual(updated);
  });

  it('inserts a bare row with the column defaults', () => {
    db.prepare("INSERT INTO sessions (id) VALUES ('bare')").run();
    expect(repo.get('bare')).toMatchObject({ phase: 'work', planned_seconds: null });
  });
});
