import { describe, expect, it } from 'vitest';
import { pickCurrentTask, sortByPlanOrder } from '../../src/shared/current-task';
import type { Task } from '../../src/shared/types';

function makeTask(overrides: Partial<Task>): Task {
  return {
    id: 'id',
    goal_id: 'g1',
    title: 'step',
    estimate_minutes: 25,
    status: 'todo',
    sort_index: 0,
    progress: 0,
    created_at: '2026-10-01T00:00:00.000Z',
    updated_at: '2026-10-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('current-task ordering', () => {
  const stepA = makeTask({ id: 'f3a9c1d2-zzzz', title: 'A', sort_index: 0 });
  const stepB = makeTask({ id: '0b7e44aa-aaaa', title: 'B', sort_index: 1 });

  it('orders unscheduled steps by sort_index, not id', () => {
    expect(sortByPlanOrder([stepB, stepA]).map((t) => t.title)).toEqual(['A', 'B']);
  });

  it('picks the first plan step as current when nothing is scheduled', () => {
    expect(pickCurrentTask([stepB, stepA])?.title).toBe('A');
  });

  it('falls back to id when sort_index ties', () => {
    const x = makeTask({ id: 'b', sort_index: 2 });
    const y = makeTask({ id: 'a', sort_index: 2 });
    expect(sortByPlanOrder([x, y]).map((t) => t.id)).toEqual(['a', 'b']);
  });

  it('still prefers in_progress over earlier plan steps', () => {
    const running = makeTask({ id: 'r', sort_index: 1, status: 'in_progress' });
    expect(pickCurrentTask([stepA, running])?.id).toBe('r');
  });
});
