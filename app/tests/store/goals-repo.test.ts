import { describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import { runMigrations } from '@main/store/db.js';
import { GoalsRepo } from '@main/store/repos/goals.js';

function makeRepo() {
  const db = new Database(':memory:');
  runMigrations(db);
  return new GoalsRepo(db);
}

describe('GoalsRepo.create', () => {
  it('persists the goal and returns it with generated id and timestamps', () => {
    const goals = makeRepo();
    const goal = goals.create({
      title: 'Learn French',
      description: 'Conversational basics',
      deadline: '2026-06-01T23:59:59Z',
      status: 'active',
    });

    expect(goal.id).toBeTruthy();
    expect(goal.title).toBe('Learn French');
    expect(goal.description).toBe('Conversational basics');
    expect(goal.deadline).toBe('2026-06-01T23:59:59Z');
    expect(goal.status).toBe('active');
    expect(goal.created_at).toBeTruthy();
    expect(goal.updated_at).toBe(goal.created_at);
  });
});

describe('GoalsRepo.get', () => {
  it('returns the persisted goal by id', () => {
    const goals = makeRepo();
    const created = goals.create({ title: 'g', description: '', status: 'active' });
    const fetched = goals.get(created.id);
    expect(fetched).toEqual(created);
  });

  it('returns null for an unknown id', () => {
    const goals = makeRepo();
    expect(goals.get('missing')).toBeNull();
  });
});

describe('GoalsRepo.list', () => {
  it('returns all goals when no filter is given', () => {
    const goals = makeRepo();
    goals.create({ title: 'a', description: '', status: 'active' });
    goals.create({ title: 'b', description: '', status: 'done' });

    const list = goals.list();
    expect(list).toHaveLength(2);
    expect(list.map((g) => g.title).sort()).toEqual(['a', 'b']);
  });

  it('filters by status when provided', () => {
    const goals = makeRepo();
    goals.create({ title: 'active goal', description: '', status: 'active' });
    goals.create({ title: 'done goal', description: '', status: 'done' });

    const active = goals.list({ status: 'active' });
    expect(active).toHaveLength(1);
    expect(active[0]?.title).toBe('active goal');

    const done = goals.list({ status: 'done' });
    expect(done).toHaveLength(1);
    expect(done[0]?.title).toBe('done goal');
  });
});

describe('GoalsRepo.update', () => {
  it('merges the patch while preserving id and created_at', async () => {
    const goals = makeRepo();
    const created = goals.create({ title: 'original', description: 'orig desc', status: 'active' });

    await new Promise((resolve) => setTimeout(resolve, 2));
    const updated = goals.update(created.id, { title: 'renamed' });

    expect(updated.id).toBe(created.id);
    expect(updated.created_at).toBe(created.created_at);
    expect(updated.title).toBe('renamed');
    expect(updated.description).toBe('orig desc');
    expect(updated.updated_at).not.toBe(created.updated_at);

    const fetched = goals.get(created.id);
    expect(fetched).toEqual(updated);
  });

  it('throws when updating a goal that does not exist', () => {
    const goals = makeRepo();
    expect(() => goals.update('missing', { title: 'x' })).toThrow(/not found/);
  });
});

describe('GoalsRepo.delete', () => {
  it('removes the row and any subsequent get returns null', () => {
    const goals = makeRepo();
    const created = goals.create({ title: 'to delete', description: '', status: 'active' });
    goals.delete(created.id);
    expect(goals.get(created.id)).toBeNull();
  });
});
