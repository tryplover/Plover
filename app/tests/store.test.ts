import { describe, expect, it, afterAll, beforeEach } from 'vitest';
import { existsSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { FileStore } from '../src/main/store/index';
import { Goal, Task } from '../src/shared/types';

describe('FileStore persistence', () => {
  const testStorePath = join('.', 'tendril-store.json');

  const cleanup = () => {
    if (existsSync(testStorePath)) {
      try {
        unlinkSync(testStorePath);
      } catch {
        // ignore
      }
    }
  };

  beforeEach(() => {
    cleanup();
  });

  afterAll(() => {
    cleanup();
  });

  it('initializes with default settings and empty goals/tasks', () => {
    const store = new FileStore();
    expect(store.getGoals()).toEqual([]);
    expect(store.getTasks()).toEqual([]);
    expect(store.getSettings().googleConnected).toBe(false);
    expect(store.getSettings().horizonDays).toBe(14);
  });

  it('can save and retrieve goals', () => {
    const store = new FileStore();
    const newGoal: Goal = {
      id: 'g1',
      title: 'Test Goal',
      description: 'Goal desc',
      deadline: '2026-12-31',
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    store.addGoal(newGoal);
    expect(store.getGoals()).toHaveLength(1);
    expect(store.getGoals()[0]).toEqual(newGoal);

    // Re-instantiate to check persistence
    const anotherStore = new FileStore();
    expect(anotherStore.getGoals()).toHaveLength(1);
    expect(anotherStore.getGoals()[0]?.title).toBe('Test Goal');
  });

  it('can save tasks and update their status', () => {
    const store = new FileStore();
    const newTask: Task = {
      id: 't1',
      goal_id: 'g1',
      title: 'Test Task',
      estimate_minutes: 60,
      status: 'todo',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    store.addTasks([newTask]);
    expect(store.getTasks()).toHaveLength(1);
    expect(store.getTasks()[0]).toEqual(newTask);

    store.updateTaskStatus('t1', 'done');
    expect(store.getTasks()[0]?.status).toBe('done');

    const anotherStore = new FileStore();
    expect(anotherStore.getTasks()[0]?.status).toBe('done');
  });

  it('can update settings', () => {
    const store = new FileStore();
    store.updateSettings({ googleConnected: true, horizonDays: 30 });
    expect(store.getSettings().googleConnected).toBe(true);
    expect(store.getSettings().horizonDays).toBe(30);

    const anotherStore = new FileStore();
    expect(anotherStore.getSettings().googleConnected).toBe(true);
    expect(anotherStore.getSettings().horizonDays).toBe(30);
  });
});
