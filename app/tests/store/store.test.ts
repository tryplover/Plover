import { describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import { runMigrations, initDb } from '@main/store/db.js';
import { GoalsRepo } from '@main/store/repos/goals.js';
import { TasksRepo } from '@main/store/repos/tasks.js';
import { SessionsRepo } from '@main/store/repos/sessions.js';
import { ActivityRepo } from '@main/store/repos/activity.js';

describe('Store Layer', () => {
  describe('Migrations', () => {
    it('applies migrations in order and is idempotent', () => {
      const db = new Database(':memory:');
      runMigrations(db);

      const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as {
        name: string;
      }[];
      const tableNames = tables.map((t) => t.name);
      expect(tableNames).toContain('goals');
      expect(tableNames).toContain('tasks');
      expect(tableNames).toContain('sessions');
      expect(tableNames).toContain('activity');
      expect(tableNames).toContain('summaries');
      expect(tableNames).toContain('settings');
      expect(tableNames).toContain('_migrations');

      expect(() => runMigrations(db)).not.toThrow();

      const versionRow = db
        .prepare('SELECT MAX(version) as current_version FROM _migrations')
        .get() as { current_version: number };
      expect(versionRow.current_version).toBe(3);
    });

    it('refuses to downgrade if db version is newer', () => {
      const db = new Database(':memory:');
      runMigrations(db);

      db.prepare('INSERT INTO _migrations (version, applied_at) VALUES (?, ?)').run(
        999,
        new Date().toISOString(),
      );

      expect(() => runMigrations(db)).toThrow(/newer than the supported code version/);
    });
  });

  describe('GoalsRepo', () => {
    it('handles create, get, list, and update round-trip', () => {
      const db = new Database(':memory:');
      runMigrations(db);
      const repo = new GoalsRepo(db);

      const created = repo.create({
        title: 'Learn Rust',
        description: 'Read the book and build small tools',
        deadline: '2026-12-31T23:59:59.000Z',
        status: 'active',
      });

      expect(created.id).toBeDefined();
      expect(created.created_at).toBeDefined();
      expect(created.updated_at).toBeDefined();
      expect(created.title).toBe('Learn Rust');
      expect(created.description).toBe('Read the book and build small tools');
      expect(created.deadline).toBe('2026-12-31T23:59:59.000Z');
      expect(created.status).toBe('active');

      expect(new Date(created.created_at).getTime()).not.toBeNaN();

      const retrieved = repo.get(created.id);
      expect(retrieved).not.toBeNull();
      expect(retrieved).toEqual(created);

      const listAll = repo.list();
      expect(listAll).toHaveLength(1);
      expect(listAll[0]).toEqual(created);

      const listActive = repo.list({ status: 'active' });
      expect(listActive).toHaveLength(1);
      const listPaused = repo.list({ status: 'paused' });
      expect(listPaused).toHaveLength(0);

      const updated = repo.update(created.id, {
        status: 'done',
        title: 'Learn Rust Advanced',
      });
      expect(updated.id).toBe(created.id);
      expect(updated.title).toBe('Learn Rust Advanced');
      expect(updated.status).toBe('done');
      expect(updated.created_at).toBe(created.created_at);
      expect(new Date(updated.updated_at).getTime()).toBeGreaterThanOrEqual(
        new Date(created.updated_at).getTime(),
      );

      const retrievedAfterUpdate = repo.get(created.id);
      expect(retrievedAfterUpdate).toEqual(updated);
    });

    it('returns null when getting non-existent goal', () => {
      const db = new Database(':memory:');
      runMigrations(db);
      const repo = new GoalsRepo(db);
      expect(repo.get('non-existent')).toBeNull();
    });

    it('throws when updating non-existent goal', () => {
      const db = new Database(':memory:');
      runMigrations(db);
      const repo = new GoalsRepo(db);
      expect(() => repo.update('non-existent', { title: 'New' })).toThrow(/not found/);
    });

    it('handles delete', () => {
      const db = new Database(':memory:');
      runMigrations(db);
      const repo = new GoalsRepo(db);

      const goal = repo.create({
        title: 'Delete me',
        status: 'active',
      });
      expect(repo.get(goal.id)).not.toBeNull();

      repo.delete(goal.id);
      expect(repo.get(goal.id)).toBeNull();
    });
  });

  describe('TasksRepo', () => {
    it('handles create, get, listByGoal, and update round-trip', () => {
      const db = new Database(':memory:');
      runMigrations(db);
      const goalsRepo = new GoalsRepo(db);
      const tasksRepo = new TasksRepo(db);

      const goal = goalsRepo.create({
        title: 'Goal A',
        status: 'active',
      });

      const task = tasksRepo.create({
        goal_id: goal.id,
        title: 'Task A',
        estimate_minutes: 45,
        status: 'todo',
        depends_on: ['parent-task-1'],
        scheduled_start: '2026-05-24T10:00:00.000Z',
        scheduled_end: '2026-05-24T10:45:00.000Z',
        calendar_event_id: 'gcal-id-123',
      });

      expect(task.id).toBeDefined();
      expect(task.goal_id).toBe(goal.id);
      expect(task.title).toBe('Task A');
      expect(task.estimate_minutes).toBe(45);
      expect(task.status).toBe('todo');
      expect(task.depends_on).toEqual(['parent-task-1']);
      expect(task.scheduled_start).toBe('2026-05-24T10:00:00.000Z');
      expect(task.scheduled_end).toBe('2026-05-24T10:45:00.000Z');
      expect(task.calendar_event_id).toBe('gcal-id-123');

      const retrieved = tasksRepo.get(task.id);
      expect(retrieved).not.toBeNull();
      expect(retrieved).toEqual(task);

      const tasksForGoal = tasksRepo.listByGoal(goal.id);
      expect(tasksForGoal).toHaveLength(1);
      expect(tasksForGoal[0]).toEqual(task);

      const updated = tasksRepo.update(task.id, {
        status: 'done',
        depends_on: ['parent-task-1', 'parent-task-2'],
      });
      expect(updated.id).toBe(task.id);
      expect(updated.status).toBe('done');
      expect(updated.depends_on).toEqual(['parent-task-1', 'parent-task-2']);

      const retrievedAfterUpdate = tasksRepo.get(task.id);
      expect(retrievedAfterUpdate).toEqual(updated);
    });

    it('handles listScheduledBetween inclusivity and overdue correctly', () => {
      const db = new Database(':memory:');
      runMigrations(db);
      const goalsRepo = new GoalsRepo(db);
      const tasksRepo = new TasksRepo(db);

      const goal = goalsRepo.create({
        title: 'Goal A',
        status: 'active',
      });

      const task1 = tasksRepo.create({
        goal_id: goal.id,
        title: 'Task 1',
        estimate_minutes: 30,
        status: 'todo',
        scheduled_start: '2026-05-24T10:00:00.000Z',
        scheduled_end: '2026-05-24T10:30:00.000Z',
      });

      const task2 = tasksRepo.create({
        goal_id: goal.id,
        title: 'Task 2',
        estimate_minutes: 30,
        status: 'todo',
        scheduled_start: '2026-05-24T10:30:00.000Z',
        scheduled_end: '2026-05-24T11:00:00.000Z',
      });

      const task3 = tasksRepo.create({
        goal_id: goal.id,
        title: 'Task 3',
        estimate_minutes: 30,
        status: 'todo',
        scheduled_start: '2026-05-24T11:00:00.000Z',
        scheduled_end: '2026-05-24T11:30:00.000Z',
      });

      const task4 = tasksRepo.create({
        goal_id: goal.id,
        title: 'Task 4',
        estimate_minutes: 30,
        status: 'todo',
        scheduled_start: '2026-05-24T09:59:59.000Z',
        scheduled_end: '2026-05-24T10:29:59.000Z',
      });

      tasksRepo.create({
        goal_id: goal.id,
        title: 'Task 5',
        estimate_minutes: 30,
        status: 'todo',
        scheduled_start: '2026-05-24T11:00:01.000Z',
        scheduled_end: '2026-05-24T11:30:01.000Z',
      });

      tasksRepo.create({
        goal_id: goal.id,
        title: 'Task 6',
        estimate_minutes: 30,
        status: 'todo',
      });

      tasksRepo.create({
        goal_id: goal.id,
        title: 'Task 7 — overdue but done',
        estimate_minutes: 30,
        status: 'done',
        scheduled_start: '2026-05-24T08:00:00.000Z',
        scheduled_end: '2026-05-24T08:30:00.000Z',
      });

      tasksRepo.create({
        goal_id: goal.id,
        title: 'Task 8 — overdue but skipped',
        estimate_minutes: 30,
        status: 'skipped',
        scheduled_start: '2026-05-24T08:00:00.000Z',
        scheduled_end: '2026-05-24T08:30:00.000Z',
      });

      const rangeStart = new Date('2026-05-24T10:00:00.000Z');
      const rangeEnd = new Date('2026-05-24T11:00:00.000Z');

      const results = tasksRepo.listScheduledBetween(rangeStart, rangeEnd);

      expect(results).toHaveLength(4);
      const ids = results.map((t) => t.id);
      expect(ids).toContain(task1.id);
      expect(ids).toContain(task2.id);
      expect(ids).toContain(task3.id);
      expect(ids).toContain(task4.id);
    });

    it('returns null when getting non-existent task', () => {
      const db = new Database(':memory:');
      runMigrations(db);
      const repo = new TasksRepo(db);
      expect(repo.get('non-existent')).toBeNull();
    });

    it('throws when updating non-existent task', () => {
      const db = new Database(':memory:');
      runMigrations(db);
      const repo = new TasksRepo(db);
      expect(() => repo.update('non-existent', { title: 'New' })).toThrow(/not found/);
    });

    it('handles deleteByGoal', () => {
      const db = new Database(':memory:');
      runMigrations(db);
      const goals = new GoalsRepo(db);
      const tasks = new TasksRepo(db);

      const goal = goals.create({ title: 'Goal', status: 'active' });
      tasks.create({ goal_id: goal.id, title: 'T1', estimate_minutes: 10, status: 'todo' });
      tasks.create({ goal_id: goal.id, title: 'T2', estimate_minutes: 20, status: 'todo' });

      expect(tasks.listByGoal(goal.id)).toHaveLength(2);

      tasks.deleteByGoal(goal.id);
      expect(tasks.listByGoal(goal.id)).toHaveLength(0);
    });
  });

  describe('Utility and Stubs', () => {
    it('initDb creates database and runs migrations', () => {
      const db = initDb(':memory:');
      expect(db).toBeDefined();
      const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as {
        name: string;
      }[];
      const tableNames = tables.map((t) => t.name);
      expect(tableNames).toContain('goals');
      db.close();
    });

    it('instantiates SessionsRepo and ActivityRepo', () => {
      const db = new Database(':memory:');
      runMigrations(db);
      const sessions = new SessionsRepo(db);
      const activity = new ActivityRepo(db);
      expect(sessions).toBeDefined();
      expect(activity).toBeDefined();
    });
  });
});
