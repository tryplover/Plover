import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { GoalsRepo } from '../../src/main/store/repos/goals.js';
import { runMigrations } from '../../src/main/store/db.js';

describe('GoalsRepo', () => {
  let db: Database.Database;
  let repo: GoalsRepo;

  beforeEach(() => {
    db = new Database(':memory:');
    runMigrations(db);
    repo = new GoalsRepo(db);
  });

  describe('create', () => {
    it('creates a goal with all fields', () => {
      const input = {
        title: 'Complete Project Plover',
        description: 'Finish all Phase 1 features',
        deadline: '2026-12-31T23:59:59.000Z',
        status: 'active' as const,
      };

      const goal = repo.create(input);

      expect(goal.id).toBeDefined();
      expect(goal.title).toBe(input.title);
      expect(goal.description).toBe(input.description);
      expect(goal.deadline).toBe(input.deadline);
      expect(goal.status).toBe(input.status);
      expect(goal.created_at).toBeDefined();
      expect(goal.updated_at).toBe(goal.created_at);

      // Verify in DB
      const dbGoal = repo.get(goal.id);
      expect(dbGoal).toEqual(goal);
    });

    it('creates a goal with minimal fields', () => {
      const input = {
        title: 'Minimal Goal',
        status: 'active' as const,
      };

      const goal = repo.create(input);

      expect(goal.title).toBe(input.title);
      expect(goal.description).toBeUndefined();
      expect(goal.deadline).toBeUndefined();
      expect(goal.status).toBe(input.status);
    });
  });

  describe('get', () => {
    it('returns null for non-existent goal', () => {
      expect(repo.get('non-existent-id')).toBeNull();
    });

    it('returns the goal for a valid id', () => {
      const goal = repo.create({ title: 'Test Goal', status: 'active' });
      const retrieved = repo.get(goal.id);
      expect(retrieved).toEqual(goal);
    });
  });

  describe('list', () => {
    it('returns all goals when no filter is provided', () => {
      repo.create({ title: 'Goal 1', status: 'active' });
      repo.create({ title: 'Goal 2', status: 'paused' });

      const goals = repo.list();
      expect(goals).toHaveLength(2);
      expect(goals.map((g) => g.title)).toContain('Goal 1');
      expect(goals.map((g) => g.title)).toContain('Goal 2');
    });

    it('filters goals by status', () => {
      repo.create({ title: 'Active Goal', status: 'active' });
      repo.create({ title: 'Paused Goal', status: 'paused' });
      repo.create({ title: 'Done Goal', status: 'done' });

      const activeGoals = repo.list({ status: 'active' });
      expect(activeGoals).toHaveLength(1);
      expect(activeGoals[0]?.title).toBe('Active Goal');

      const pausedGoals = repo.list({ status: 'paused' });
      expect(pausedGoals).toHaveLength(1);
      expect(pausedGoals[0]?.title).toBe('Paused Goal');
    });

    it('returns empty list when no goals match the filter', () => {
      repo.create({ title: 'Active Goal', status: 'active' });
      const droppedGoals = repo.list({ status: 'dropped' });
      expect(droppedGoals).toHaveLength(0);
    });
  });

  describe('update', () => {
    it('updates specified fields and updated_at', async () => {
      const goal = repo.create({ title: 'Original Title', status: 'active' });
      const originalUpdatedAt = goal.updated_at;

      // Small delay to ensure updated_at changes
      await new Promise((resolve) => setTimeout(resolve, 1));

      const updated = repo.update(goal.id, {
        title: 'New Title',
        status: 'done',
      });

      expect(updated.id).toBe(goal.id);
      expect(updated.title).toBe('New Title');
      expect(updated.status).toBe('done');
      expect(updated.created_at).toBe(goal.created_at);
      expect(updated.updated_at).not.toBe(originalUpdatedAt);

      const dbGoal = repo.get(goal.id);
      expect(dbGoal?.title).toBe('New Title');
      expect(dbGoal?.status).toBe('done');
    });

    it('can clear description and deadline', () => {
      const goal = repo.create({
        title: 'Goal with extras',
        description: 'Extra info',
        deadline: '2026-01-01T00:00:00Z',
        status: 'active',
      });

      const updated = repo.update(goal.id, {
        description: undefined,
        deadline: undefined,
      });

      expect(updated.description).toBeUndefined();
      expect(updated.deadline).toBeUndefined();

      const dbGoal = repo.get(goal.id);
      expect(dbGoal?.description).toBeUndefined();
      expect(dbGoal?.deadline).toBeUndefined();
    });

    it('throws error when updating non-existent goal', () => {
      expect(() => repo.update('non-existent', { title: 'New' })).toThrow(
        'Goal with id non-existent not found',
      );
    });
  });
});
