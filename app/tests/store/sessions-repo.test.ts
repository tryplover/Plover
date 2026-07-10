import { describe, expect, it, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { runMigrations } from '@main/store/db.js';
import { SessionsRepo } from '@main/store/repos/sessions.js';
import { GoalsRepo } from '@main/store/repos/goals.js';
import { TasksRepo } from '@main/store/repos/tasks.js';

describe('SessionsRepo', () => {
  let db: Database.Database;
  let repo: SessionsRepo;
  let goalsRepo: GoalsRepo;
  let tasksRepo: TasksRepo;

  beforeEach(() => {
    db = new Database(':memory:');
    runMigrations(db);
    repo = new SessionsRepo(db);
    goalsRepo = new GoalsRepo(db);
    tasksRepo = new TasksRepo(db);
  });

  const seedTask = () => {
    const goal = goalsRepo.create({
      title: 'Goal',
      status: 'active',
    });
    return tasksRepo.create({
      goal_id: goal.id,
      title: 'Task',
      estimate_minutes: 30,
      status: 'todo',
    });
  };

  it('handles create, get, list, and update round-trip', () => {
    const task = seedTask();
    const start = new Date().toISOString();
    const created = repo.create({
      task_id: task.id,
      started_at: start,
      ended_at: null,
    });

    expect(created.id).toBeDefined();
    expect(created.task_id).toBe(task.id);
    expect(created.started_at).toBe(start);
    expect(created.ended_at).toBeNull();

    const retrieved = repo.get(created.id);
    expect(retrieved).toEqual(created);

    const all = repo.list();
    expect(all).toHaveLength(1);
    expect(all[0]).toEqual(created);

    const end = new Date().toISOString();
    const updated = repo.update(created.id, {
      ended_at: end,
    });
    expect(updated.ended_at).toBe(end);

    const retrievedAfterUpdate = repo.get(created.id);
    expect(retrievedAfterUpdate?.ended_at).toBe(end);
  });

  it('returns null when getting non-existent session', () => {
    expect(repo.get('non-existent')).toBeNull();
  });

  it('throws when updating non-existent session', () => {
    expect(() => repo.update('non-existent', { started_at: '2026-01-01' })).toThrow(/not found/);
  });

  it('handles session with null task_id', () => {
    const start = new Date().toISOString();
    const created = repo.create({
      task_id: null,
      started_at: start,
      ended_at: null,
    });
    expect(created.task_id).toBeNull();
    expect(repo.get(created.id)?.task_id).toBeNull();
  });

  it('deletes a session', () => {
    const created = repo.create({
      task_id: null,
      started_at: new Date().toISOString(),
      ended_at: null,
    });
    expect(repo.list()).toHaveLength(1);
    repo.delete(created.id);
    expect(repo.list()).toHaveLength(0);
    expect(repo.get(created.id)).toBeNull();
  });
});
