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

  it('creates and retrieves a session', () => {
    const task = seedTask();
    const startedAt = new Date().toISOString();
    const created = repo.create({
      task_id: task.id,
      started_at: startedAt,
      ended_at: null,
    });

    expect(created.id).toBeDefined();
    expect(created.task_id).toBe(task.id);
    expect(created.started_at).toBe(startedAt);
    expect(created.ended_at).toBeNull();

    const fetched = repo.get(created.id);
    expect(fetched).toEqual(created);
  });

  it('returns null for non-existent session', () => {
    expect(repo.get('non-existent')).toBeNull();
  });

  it('lists sessions for a task', () => {
    const task1 = seedTask();
    const task2 = seedTask();

    repo.create({ task_id: task1.id, started_at: '2026-01-01T10:00:00Z', ended_at: '2026-01-01T11:00:00Z' });
    repo.create({ task_id: task1.id, started_at: '2026-01-01T12:00:00Z', ended_at: '2026-01-01T13:00:00Z' });
    repo.create({ task_id: task2.id, started_at: '2026-01-01T14:00:00Z', ended_at: '2026-01-01T15:00:00Z' });

    const task1Sessions = repo.listForTask(task1.id);
    expect(task1Sessions).toHaveLength(2);
    expect(task1Sessions[0]?.started_at).toBe('2026-01-01T10:00:00Z');
    expect(task1Sessions[1]?.started_at).toBe('2026-01-01T12:00:00Z');

    const task2Sessions = repo.listForTask(task2.id);
    expect(task2Sessions).toHaveLength(1);
  });

  it('updates a session', () => {
    const task = seedTask();
    const session = repo.create({
      task_id: task.id,
      started_at: '2026-01-01T10:00:00Z',
      ended_at: null,
    });

    const endedAt = '2026-01-01T11:00:00Z';
    const updated = repo.update(session.id, { ended_at: endedAt });

    expect(updated.id).toBe(session.id);
    expect(updated.ended_at).toBe(endedAt);

    const fetched = repo.get(session.id);
    expect(fetched?.ended_at).toBe(endedAt);
  });

  it('throws when updating non-existent session', () => {
    expect(() => repo.update('non-existent', { ended_at: '...' })).toThrow();
  });

  it('deletes a session', () => {
    const task = seedTask();
    const session = repo.create({
      task_id: task.id,
      started_at: '2026-01-01T10:00:00Z',
      ended_at: '2026-01-01T11:00:00Z',
    });

    repo.delete(session.id);
    expect(repo.get(session.id)).toBeNull();
  });

  it('allows sessions with null task_id', () => {
    const session = repo.create({
      task_id: null,
      started_at: '2026-01-01T10:00:00Z',
      ended_at: '2026-01-01T11:00:00Z',
    });

    expect(session.task_id).toBeNull();
    const fetched = repo.get(session.id);
    expect(fetched?.task_id).toBeNull();
  });
});
