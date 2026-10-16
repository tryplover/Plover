import { describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import { runMigrations } from '@main/store/db.js';
import { TasksRepo } from '@main/store/repos/tasks.js';
import { GoalsRepo } from '@main/store/repos/goals.js';

function makeRepos() {
  const db = new Database(':memory:');
  runMigrations(db);
  const tasks = new TasksRepo(db);
  const goals = new GoalsRepo(db);
  return { tasks, goals, db };
}

describe('TasksRepo.reorder', () => {
  it('renumbers sort_index to 0..N-1 in the given order', () => {
    const { tasks, goals } = makeRepos();
    const goal = goals.create({ title: 'g', description: '', status: 'active' });
    tasks.create({ id: 'a', goal_id: goal.id, title: 'a', estimate_minutes: 10, status: 'todo' });
    tasks.create({ id: 'b', goal_id: goal.id, title: 'b', estimate_minutes: 10, status: 'todo' });
    tasks.create({ id: 'c', goal_id: goal.id, title: 'c', estimate_minutes: 10, status: 'todo' });
    tasks.reorder(goal.id, ['c', 'a', 'b']);
    const list = tasks.listByGoal(goal.id);
    const [l0, l1, l2] = list;
    expect(l0?.id).toBe('c');
    expect(l0?.sort_index).toBe(0);
    expect(l1?.id).toBe('a');
    expect(l1?.sort_index).toBe(1);
    expect(l2?.id).toBe('b');
    expect(l2?.sort_index).toBe(2);
  });

  it("throws when orderedIds is not exactly the goal's task id set", () => {
    const { tasks, goals } = makeRepos();
    const goal = goals.create({ title: 'g', description: '', status: 'active' });
    tasks.create({ id: 'a', goal_id: goal.id, title: 'a', estimate_minutes: 10, status: 'todo' });
    expect(() => tasks.reorder(goal.id, ['a', 'missing'])).toThrow(/id set mismatch/);
    expect(() => tasks.reorder(goal.id, [])).toThrow(/id set mismatch/);
  });
});

describe('TasksRepo.delete', () => {
  it('removes the row and any subsequent get returns null', () => {
    const { tasks, goals } = makeRepos();
    const goal = goals.create({ title: 'g', description: '', status: 'active' });
    tasks.create({ id: 'a', goal_id: goal.id, title: 'a', estimate_minutes: 10, status: 'todo' });
    tasks.delete('a');
    expect(tasks.get('a')).toBeNull();
  });
});

describe('TasksRepo status_changed_at', () => {
  it('starts at created_at on insert', () => {
    const { tasks, goals } = makeRepos();
    const goal = goals.create({ title: 'g', description: '', status: 'active' });
    const task = tasks.create({
      id: 'a',
      goal_id: goal.id,
      title: 'a',
      estimate_minutes: 10,
      status: 'todo',
    });
    const row = tasks.listStallInputs().find((r) => r.id === 'a');
    expect(row?.status_changed_at).toBe(task.created_at);
  });

  it('setManualStatus sets status and status_changed_at to the given time', () => {
    const { tasks, goals } = makeRepos();
    const goal = goals.create({ title: 'g', description: '', status: 'active' });
    tasks.create({ id: 'a', goal_id: goal.id, title: 'a', estimate_minutes: 10, status: 'todo' });
    const at = new Date('2026-10-13T09:30:00.000Z');

    const updated = tasks.setManualStatus('a', 'in_progress', at);

    expect(updated.status).toBe('in_progress');
    expect(tasks.get('a')?.status).toBe('in_progress');
    expect(tasks.listStallInputs()).toEqual([
      {
        id: 'a',
        goal_id: goal.id,
        status: 'in_progress',
        status_changed_at: at.toISOString(),
      },
    ]);
  });

  it('setManualStatus throws for an unknown task id', () => {
    const { tasks } = makeRepos();
    expect(() => tasks.setManualStatus('missing', 'done', new Date())).toThrow(/not found/);
  });

  it('update does not touch status_changed_at', () => {
    const { tasks, goals } = makeRepos();
    const goal = goals.create({ title: 'g', description: '', status: 'active' });
    const task = tasks.create({
      id: 'a',
      goal_id: goal.id,
      title: 'a',
      estimate_minutes: 10,
      status: 'todo',
    });

    tasks.update('a', { status: 'done' });

    expect(tasks.get('a')?.status).toBe('done');
    expect(tasks.listStallInputs().find((r) => r.id === 'a')?.status_changed_at).toBe(
      task.created_at,
    );
  });
});
