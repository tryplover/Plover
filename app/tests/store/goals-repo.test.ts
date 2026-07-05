import { describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import { runMigrations } from '@main/store/db.js';
import { GoalsRepo } from '@main/store/repos/goals.js';
import { TasksRepo } from '@main/store/repos/tasks.js';

describe('GoalsRepo', () => {
  const setup = () => {
    const db = new Database(':memory:');
    db.pragma('foreign_keys = ON');
    runMigrations(db);
    const repo = new GoalsRepo(db);
    return { db, repo };
  };

  it('creates and retrieves a goal', () => {
    const { repo } = setup();
    const now = new Date().toISOString();

    const goal = repo.create({
      title: 'Test Goal',
      description: 'Test Description',
      deadline: '2026-05-24T12:00:00Z',
      status: 'active',
    });

    expect(goal.id).toBeDefined();
    expect(goal.title).toBe('Test Goal');
    expect(goal.description).toBe('Test Description');
    expect(goal.deadline).toBe('2026-05-24T12:00:00Z');
    expect(goal.status).toBe('active');
    expect(goal.created_at).toBeDefined();
    expect(goal.updated_at).toBeDefined();

    // Check it matches the creation time (approx)
    expect(new Date(goal.created_at).getTime()).toBeGreaterThanOrEqual(new Date(now).getTime());

    const retrieved = repo.get(goal.id);
    expect(retrieved).toEqual(goal);
  });

  it('returns null for non-existent goal', () => {
    const { repo } = setup();
    expect(repo.get('non-existent')).toBeNull();
  });

  it('lists goals and filters by status', () => {
    const { repo } = setup();
    repo.create({ title: 'Active 1', status: 'active' });
    repo.create({ title: 'Active 2', status: 'active' });
    repo.create({ title: 'Paused', status: 'paused' });

    expect(repo.list()).toHaveLength(3);

    const activeGoals = repo.list({ status: 'active' });
    expect(activeGoals).toHaveLength(2);
    expect(activeGoals.every(g => g.status === 'active')).toBe(true);

    const pausedGoals = repo.list({ status: 'paused' });
    expect(pausedGoals).toHaveLength(1);
    const [p0] = pausedGoals;
    expect(p0?.title).toBe('Paused');
  });

  it('updates a goal and maintains updated_at monotonicity', async () => {
    const { repo } = setup();
    const goal = repo.create({ title: 'Old Title', status: 'active' });
    const originalCreatedAt = goal.created_at;
    const originalUpdatedAt = goal.updated_at;

    // Wait a tiny bit to ensure timestamp difference
    await new Promise(resolve => setTimeout(resolve, 10));

    const updated = repo.update(goal.id, {
      title: 'New Title',
      status: 'done',
    });

    expect(updated.title).toBe('New Title');
    expect(updated.status).toBe('done');
    expect(updated.created_at).toBe(originalCreatedAt);
    expect(new Date(updated.updated_at).getTime()).toBeGreaterThan(new Date(originalUpdatedAt).getTime());

    const retrieved = repo.get(goal.id);
    expect(retrieved?.title).toBe('New Title');
    expect(retrieved?.status).toBe('done');
  });

  it('throws error when updating non-existent goal', () => {
    const { repo } = setup();
    expect(() => repo.update('non-existent', { title: 'Fail' })).toThrow(/not found/);
  });

  it('enforces foreign key constraints on deletion', () => {
    const { db, repo } = setup();
    const tasksRepo = new TasksRepo(db);

    const goal = repo.create({ title: 'Bound Goal', status: 'active' });
    tasksRepo.create({
      goal_id: goal.id,
      title: 'Subtask',
      estimate_minutes: 30,
      status: 'todo',
    });

    // Try to delete goal directly via SQL
    const deleteStmt = db.prepare('DELETE FROM goals WHERE id = ?');

    // This should throw because of the task referencing it
    expect(() => deleteStmt.run(goal.id)).toThrow(/FOREIGN KEY constraint failed/);
  });
});
