import { describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import { runMigrations } from '@main/store/db.js';
import { SummariesRepo } from '@main/store/repos/summaries.js';
import { TasksRepo } from '@main/store/repos/tasks.js';
import { GoalsRepo } from '@main/store/repos/goals.js';

function seedTask(db: Database.Database, taskId: string): void {
  const goalsRepo = new GoalsRepo(db);
  const tasksRepo = new TasksRepo(db);
  const goal = goalsRepo.create({ title: 'Test goal', status: 'active' });
  tasksRepo.create({
    id: taskId,
    goal_id: goal.id,
    title: `Task ${taskId}`,
    estimate_minutes: 30,
    status: 'todo',
    depends_on: [],
    scheduled_start: undefined,
    scheduled_end: undefined,
    calendar_event_id: undefined,
  });
}

describe('SummariesRepo', () => {
  it('inserts and retrieves summary rows', () => {
    const db = new Database(':memory:');
    runMigrations(db);
    seedTask(db, 'task-123');
    const repo = new SummariesRepo(db);

    const now = new Date().toISOString();
    const row = repo.insert({
      taskId: 'task-123',
      summary: 'Task was completed successfully',
      signal: 0.95,
      ts: now,
    });

    expect(row.id).toBeDefined();
    expect(row.task_id).toBe('task-123');
    expect(row.ts).toBe(now);
    expect(row.summary).toBe('Task was completed successfully');
    expect(row.signal).toBe(0.95);
  });

  it('listForTask returns summaries for a specific task', () => {
    const db = new Database(':memory:');
    runMigrations(db);
    seedTask(db, 'task-1');
    seedTask(db, 'task-2');
    const repo = new SummariesRepo(db);

    const t1 = '2026-01-01T10:00:00.000Z';
    const t2 = '2026-01-01T10:05:00.000Z';
    const t3 = '2026-01-01T10:10:00.000Z';

    repo.insert({ taskId: 'task-1', summary: 'First summary', signal: 0.8, ts: t1 });
    repo.insert({ taskId: 'task-1', summary: 'Second summary', signal: 0.9, ts: t2 });
    repo.insert({ taskId: 'task-2', summary: 'Different task', signal: 0.7, ts: t3 });

    const result = repo.listForTask('task-1');
    expect(result).toHaveLength(2);
    const [r0, r1] = result;
    expect(r0?.summary).toBe('First summary');
    expect(r0?.signal).toBe(0.8);
    expect(r1?.summary).toBe('Second summary');
    expect(r1?.signal).toBe(0.9);

    const otherTask = repo.listForTask('task-2');
    expect(otherTask).toHaveLength(1);
    const [o0] = otherTask;
    expect(o0?.summary).toBe('Different task');
  });

  it('handles null task_id for global summaries', () => {
    const db = new Database(':memory:');
    runMigrations(db);
    const repo = new SummariesRepo(db);

    const row = repo.insert({
      taskId: null,
      summary: 'Global summary',
      signal: 0.5,
    });

    expect(row.task_id).toBeNull();
    expect(row.summary).toBe('Global summary');

    const retrieved = repo.listForTask('nonexistent-task');
    expect(retrieved).toHaveLength(0);
  });

  it('generates timestamps if not provided', () => {
    const db = new Database(':memory:');
    runMigrations(db);
    seedTask(db, 'task-1');
    const repo = new SummariesRepo(db);

    const row = repo.insert({
      taskId: 'task-1',
      summary: 'Auto-timestamped summary',
      signal: 0.75,
    });

    expect(row.ts).toBeDefined();
    const ts = new Date(row.ts);
    expect(ts.getTime()).not.toBeNaN();
  });

  it('returns summaries ordered by timestamp', () => {
    const db = new Database(':memory:');
    runMigrations(db);
    seedTask(db, 'task-1');
    const repo = new SummariesRepo(db);

    const t1 = '2026-01-01T10:10:00.000Z';
    const t2 = '2026-01-01T10:00:00.000Z';
    const t3 = '2026-01-01T10:05:00.000Z';

    repo.insert({ taskId: 'task-1', summary: 's1', signal: 0.8, ts: t1 });
    repo.insert({ taskId: 'task-1', summary: 's2', signal: 0.9, ts: t2 });
    repo.insert({ taskId: 'task-1', summary: 's3', signal: 0.7, ts: t3 });

    const result = repo.listForTask('task-1');
    const [r0, r1, r2] = result;
    expect(r0?.summary).toBe('s2');
    expect(r1?.summary).toBe('s3');
    expect(r2?.summary).toBe('s1');
  });
});
