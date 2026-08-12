import { describe, it, expect } from 'vitest';
import { goalProgress } from '@shared/goal-progress.js';
import type { Task } from '@shared/types.js';

function task(id: string, status: Task['status'], progress = 0): Task {
  return {
    id,
    goal_id: 'g1',
    title: `Task ${id}`,
    estimate_minutes: 30,
    status,
    sort_index: 0,
    progress,
    created_at: '2026-06-12T10:00:00.000Z',
    updated_at: '2026-06-12T10:00:00.000Z',
  };
}

describe('goalProgress', () => {
  it('returns 0 for a goal with no tasks', () => {
    expect(goalProgress([], null)).toBe(0);
  });

  it('counts only finished steps when there is no current task', () => {
    const tasks = [task('a', 'done'), task('b', 'todo'), task('c', 'todo'), task('d', 'todo')];
    expect(goalProgress(tasks, null)).toBe(0.25);
  });

  it('blends the current step fraction into the finished-step count', () => {
    const tasks = [
      task('a', 'done'),
      task('b', 'done'),
      task('c', 'in_progress', 50),
      task('d', 'todo'),
      task('e', 'todo'),
      task('f', 'todo'),
    ];
    expect(goalProgress(tasks, 'c')).toBeCloseTo(2.5 / 6);
  });

  it('does not double-count a current task that is already done', () => {
    const tasks = [task('a', 'done', 100), task('b', 'todo')];
    expect(goalProgress(tasks, 'a')).toBe(0.5);
  });

  it('ignores progress carried by a skipped current task', () => {
    const tasks = [task('a', 'skipped', 80), task('b', 'done')];
    expect(goalProgress(tasks, 'a')).toBe(0.5);
  });

  it('ignores a currentTaskId that is not in this goal', () => {
    const tasks = [task('a', 'done'), task('b', 'in_progress', 90)];
    expect(goalProgress(tasks, 'not-in-this-goal')).toBe(0.5);
  });

  it('returns 1 when every step is done', () => {
    expect(goalProgress([task('a', 'done'), task('b', 'done')], null)).toBe(1);
  });

  it('never exceeds 1 when the last step is estimated at 100', () => {
    const tasks = [task('a', 'done'), task('b', 'in_progress', 100)];
    expect(goalProgress(tasks, 'b')).toBe(1);
  });

  it('lets an unstarted goal move off zero once the current step has progress', () => {
    const tasks = [task('a', 'in_progress', 20), task('b', 'todo')];
    expect(goalProgress(tasks, 'a')).toBeCloseTo(0.1);
  });
});
