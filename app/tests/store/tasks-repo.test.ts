import { describe, expect, it, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { runMigrations } from '@main/store/db.js';
import { TasksRepo } from '@main/store/repos/tasks.js';
import { GoalsRepo } from '@main/store/repos/goals.js';

describe('TasksRepo', () => {
  let db: Database.Database;
  let repo: TasksRepo;
  let goalsRepo: GoalsRepo;
  let goalId: string;

  beforeEach(() => {
    db = new Database(':memory:');
    runMigrations(db);
    repo = new TasksRepo(db);
    goalsRepo = new GoalsRepo(db);

    const goal = goalsRepo.create({
      title: 'Test Goal',
      status: 'active',
    });
    goalId = goal.id;
  });

  it('creates and retrieves a task', () => {
    const task = repo.create({
      goal_id: goalId,
      title: 'Test Task',
      estimate_minutes: 30,
      status: 'todo',
    });

    expect(task.id).toBeDefined();
    expect(task.title).toBe('Test Task');
    expect(task.created_at).toBeDefined();
    expect(task.updated_at).toBe(task.created_at);

    const fetched = repo.get(task.id);
    expect(fetched).toEqual(task);
  });

  it('returns null for non-existent task', () => {
    expect(repo.get('non-existent')).toBeNull();
  });

  it('lists tasks', () => {
    repo.create({ goal_id: goalId, title: 'Task 1', estimate_minutes: 10, status: 'todo' });
    repo.create({ goal_id: goalId, title: 'Task 2', estimate_minutes: 20, status: 'todo' });

    const tasks = repo.list();
    expect(tasks).toHaveLength(2);
    expect(tasks.map((t) => t.title)).toContain('Task 1');
    expect(tasks.map((t) => t.title)).toContain('Task 2');
  });

  it('lists tasks by goal', () => {
    const otherGoal = goalsRepo.create({ title: 'Other Goal', status: 'active' });
    repo.create({ goal_id: goalId, title: 'Goal 1 Task', estimate_minutes: 10, status: 'todo' });
    repo.create({
      goal_id: otherGoal.id,
      title: 'Goal 2 Task',
      estimate_minutes: 10,
      status: 'todo',
    });

    const tasks = repo.listByGoal(goalId);
    expect(tasks).toHaveLength(1);
    expect(tasks[0]?.title).toBe('Goal 1 Task');
  });

  it('updates a task', () => {
    const task = repo.create({
      goal_id: goalId,
      title: 'Original Title',
      estimate_minutes: 30,
      status: 'todo',
    });

    const updated = repo.update(task.id, { title: 'Updated Title', status: 'in_progress' });
    expect(updated.title).toBe('Updated Title');
    expect(updated.status).toBe('in_progress');
    expect(updated.id).toBe(task.id);
    expect(updated.created_at).toBe(task.created_at);
    expect(new Date(updated.updated_at).getTime()).toBeGreaterThanOrEqual(
      new Date(task.updated_at).getTime(),
    );
  });

  it('listScheduledBetween returns tasks in range or overdue', () => {
    // Overdue task (scheduled in the past, not done)
    repo.create({
      goal_id: goalId,
      title: 'Overdue',
      estimate_minutes: 30,
      status: 'todo',
      scheduled_start: '2026-01-01T08:00:00.000Z',
      scheduled_end: '2026-01-01T08:30:00.000Z',
    });

    // In range task
    repo.create({
      goal_id: goalId,
      title: 'In Range',
      estimate_minutes: 30,
      status: 'scheduled',
      scheduled_start: '2026-01-01T10:30:00.000Z',
      scheduled_end: '2026-01-01T11:00:00.000Z',
    });

    // Out of range task (future)
    repo.create({
      goal_id: goalId,
      title: 'Future',
      estimate_minutes: 30,
      status: 'scheduled',
      scheduled_start: '2026-01-01T15:00:00.000Z',
      scheduled_end: '2026-01-01T15:30:00.000Z',
    });

    // Past done task (should NOT be included if before start)
    repo.create({
      goal_id: goalId,
      title: 'Done Past',
      estimate_minutes: 30,
      status: 'done',
      scheduled_start: '2026-01-01T07:00:00.000Z',
      scheduled_end: '2026-01-01T07:30:00.000Z',
    });

    const start = new Date('2026-01-01T10:00:00.000Z');
    const end = new Date('2026-01-01T12:00:00.000Z');

    const result = repo.listScheduledBetween(start, end);
    expect(result).toHaveLength(2);
    expect(result.map((t) => t.title)).toContain('Overdue');
    expect(result.map((t) => t.title)).toContain('In Range');
  });

  it('listActiveScheduledBefore returns active tasks that ended before now', () => {
    const now = new Date('2026-01-01T12:00:00.000Z');

    // Ended before now, active
    repo.create({
      goal_id: goalId,
      title: 'Should find',
      estimate_minutes: 30,
      status: 'todo',
      scheduled_start: '2026-01-01T11:00:00.000Z',
      scheduled_end: '2026-01-01T11:30:00.000Z',
    });

    // Ended before now, done
    repo.create({
      goal_id: goalId,
      title: 'Done',
      estimate_minutes: 30,
      status: 'done',
      scheduled_start: '2026-01-01T11:00:00.000Z',
      scheduled_end: '2026-01-01T11:30:00.000Z',
    });

    // Ends after now
    repo.create({
      goal_id: goalId,
      title: 'Future',
      estimate_minutes: 30,
      status: 'scheduled',
      scheduled_start: '2026-01-01T12:30:00.000Z',
      scheduled_end: '2026-01-01T13:00:00.000Z',
    });

    const result = repo.listActiveScheduledBefore(now);
    expect(result).toHaveLength(1);
    expect(result[0]?.title).toBe('Should find');
  });

  it('handles depends_on correctly', () => {
    const t1 = repo.create({ goal_id: goalId, title: 'T1', estimate_minutes: 10, status: 'todo' });
    const t2 = repo.create({
      goal_id: goalId,
      title: 'T2',
      estimate_minutes: 10,
      status: 'todo',
      depends_on: [t1.id],
    });

    expect(t2.depends_on).toEqual([t1.id]);

    const fetched = repo.get(t2.id);
    expect(fetched?.depends_on).toEqual([t1.id]);

    const updated = repo.update(t2.id, { depends_on: [] });
    expect(updated.depends_on).toEqual([]);

    const fetched2 = repo.get(t2.id);
    expect(fetched2?.depends_on).toEqual([]);
  });
});
