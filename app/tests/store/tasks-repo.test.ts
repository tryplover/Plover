import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { TasksRepo } from '../../src/main/store/repos/tasks.js';
import { GoalsRepo } from '../../src/main/store/repos/goals.js';
import { runMigrations } from '../../src/main/store/db.js';

function seedTask(db: Database.Database, taskId: string, createdAt?: string): void {
  const goalsRepo = new GoalsRepo(db);
  const tasksRepo = new TasksRepo(db);
  const goal = goalsRepo.create({ title: 'Test goal', status: 'active' });

  const input: Parameters<typeof tasksRepo.create>[0] & { id?: string } = {
    id: taskId,
    goal_id: goal.id,
    title: `Task ${taskId}`,
    estimate_minutes: 30,
    status: 'todo',
    depends_on: [],
    scheduled_start: undefined,
    scheduled_end: undefined,
    calendar_event_id: undefined,
  };

  tasksRepo.create(input);

  if (createdAt) {
    const stmt = db.prepare('UPDATE tasks SET created_at = ? WHERE id = ?');
    stmt.run(createdAt, taskId);
  }
}

describe('TasksRepo — countCreatedBetween', () => {
  let db: Database.Database;
  let repo: TasksRepo;

  beforeEach(() => {
    db = new Database(':memory:');
    runMigrations(db);
    repo = new TasksRepo(db);
  });

  it('returns zero when no tasks exist', () => {
    const start = new Date('2026-07-01T00:00:00.000Z');
    const end = new Date('2026-07-08T00:00:00.000Z');
    const count = repo.countCreatedBetween(start, end);
    expect(count).toBe(0);
  });

  it('counts a task created within [start, end)', () => {
    const start = new Date('2026-07-01T00:00:00.000Z');
    const end = new Date('2026-07-08T00:00:00.000Z');
    const taskCreatedAt = '2026-07-04T12:30:00.000Z';

    seedTask(db, 'task-1', taskCreatedAt);

    const count = repo.countCreatedBetween(start, end);
    expect(count).toBe(1);
  });

  it('includes a task created exactly at start', () => {
    const start = new Date('2026-07-01T00:00:00.000Z');
    const end = new Date('2026-07-08T00:00:00.000Z');

    seedTask(db, 'task-1', start.toISOString());

    const count = repo.countCreatedBetween(start, end);
    expect(count).toBe(1);
  });

  it('excludes a task created exactly at end', () => {
    const start = new Date('2026-07-01T00:00:00.000Z');
    const end = new Date('2026-07-08T00:00:00.000Z');

    seedTask(db, 'task-1', end.toISOString());

    const count = repo.countCreatedBetween(start, end);
    expect(count).toBe(0);
  });

  it('counts multiple tasks across different goals', () => {
    const start = new Date('2026-07-01T00:00:00.000Z');
    const end = new Date('2026-07-08T00:00:00.000Z');

    seedTask(db, 'task-1', '2026-07-02T10:00:00.000Z');
    seedTask(db, 'task-2', '2026-07-04T15:00:00.000Z');
    seedTask(db, 'task-3', '2026-07-06T08:00:00.000Z');

    const count = repo.countCreatedBetween(start, end);
    expect(count).toBe(3);
  });

  it('excludes tasks outside the range', () => {
    const start = new Date('2026-07-01T00:00:00.000Z');
    const end = new Date('2026-07-08T00:00:00.000Z');

    seedTask(db, 'task-before', '2026-06-30T23:59:59.000Z');
    seedTask(db, 'task-within', '2026-07-04T12:00:00.000Z');
    seedTask(db, 'task-after', '2026-07-08T00:00:01.000Z');

    const count = repo.countCreatedBetween(start, end);
    expect(count).toBe(1);
  });
});
