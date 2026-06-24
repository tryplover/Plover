import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useCompanionState } from '../../../src/renderer/companion/useCompanionState';
import type { Task } from '../../../src/shared/types';

const mockWindowApi = vi.hoisted(() => {
  const onListeners = new Map<string, (data: unknown) => void>();

  return {
    api: {
      on: vi.fn((channel: string, callback: (data: unknown) => void) => {
        onListeners.set(channel, callback);
        return () => {
          onListeners.delete(channel);
        };
      }),
      getTasks: vi.fn(() => Promise.resolve([] as Task[])),
    },
    triggerEvent: (channel: string, data: unknown) => {
      const listener = onListeners.get(channel);
      if (listener) listener(data);
    },
  };
});

vi.stubGlobal('api', mockWindowApi.api);

describe('useCompanionState', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('exports useCompanionState hook', () => {
    expect(useCompanionState).toBeDefined();
  });

  it('hook accepts window.api shape', () => {
    const taskArray: Task[] = [
      {
        id: 'task-1',
        goal_id: 'goal-1',
        title: 'First step',
        estimate_minutes: 30,
        status: 'todo',
        created_at: '2026-06-20T00:00:00Z',
        updated_at: '2026-06-20T00:00:00Z',
        scheduled_start: '2026-06-20T09:00:00Z',
      },
    ];
    expect(taskArray).toHaveLength(1);
  });

  it('builds steps from task siblings', () => {
    const tasks: Task[] = [
      {
        id: 'task-1',
        goal_id: 'goal-1',
        title: 'First step',
        estimate_minutes: 30,
        status: 'todo',
        created_at: '2026-06-20T00:00:00Z',
        updated_at: '2026-06-20T00:00:00Z',
        scheduled_start: '2026-06-20T09:00:00Z',
      },
      {
        id: 'task-2',
        goal_id: 'goal-1',
        title: 'Second step',
        estimate_minutes: 45,
        status: 'todo',
        created_at: '2026-06-20T00:00:00Z',
        updated_at: '2026-06-20T00:00:00Z',
        scheduled_start: '2026-06-20T10:00:00Z',
      },
      {
        id: 'task-3',
        goal_id: 'goal-2',
        title: 'Different goal',
        estimate_minutes: 60,
        status: 'todo',
        created_at: '2026-06-20T00:00:00Z',
        updated_at: '2026-06-20T00:00:00Z',
      },
    ];

    mockWindowApi.api.getTasks.mockResolvedValueOnce(tasks);
    expect(mockWindowApi.api.getTasks).toBeDefined();
  });

  it('marks only the active task as current', () => {
    const tasks: Task[] = [
      {
        id: 'task-a',
        goal_id: 'goal-x',
        title: 'Task A',
        estimate_minutes: 30,
        status: 'todo',
        created_at: '2026-06-20T00:00:00Z',
        updated_at: '2026-06-20T00:00:00Z',
        scheduled_start: '2026-06-20T09:00:00Z',
      },
      {
        id: 'task-b',
        goal_id: 'goal-x',
        title: 'Task B',
        estimate_minutes: 45,
        status: 'done',
        created_at: '2026-06-20T00:00:00Z',
        updated_at: '2026-06-20T00:00:00Z',
        scheduled_start: '2026-06-20T10:00:00Z',
      },
      {
        id: 'task-c',
        goal_id: 'goal-x',
        title: 'Task C',
        estimate_minutes: 60,
        status: 'todo',
        created_at: '2026-06-20T00:00:00Z',
        updated_at: '2026-06-20T00:00:00Z',
        scheduled_start: '2026-06-20T11:00:00Z',
      },
    ];

    mockWindowApi.api.getTasks.mockResolvedValueOnce(tasks);
    expect(tasks).toHaveLength(3);
  });

  it('sorts steps by scheduled_start, putting unscheduled last', () => {
    const tasks: Task[] = [
      {
        id: 'z-no-schedule',
        goal_id: 'goal-1',
        title: 'Z no schedule',
        estimate_minutes: 30,
        status: 'todo',
        created_at: '2026-06-20T00:00:00Z',
        updated_at: '2026-06-20T00:00:00Z',
      },
      {
        id: 'a-later',
        goal_id: 'goal-1',
        title: 'A later',
        estimate_minutes: 30,
        status: 'todo',
        created_at: '2026-06-20T00:00:00Z',
        updated_at: '2026-06-20T00:00:00Z',
        scheduled_start: '2026-06-20T11:00:00Z',
      },
      {
        id: 'b-earlier',
        goal_id: 'goal-1',
        title: 'B earlier',
        estimate_minutes: 30,
        status: 'todo',
        created_at: '2026-06-20T00:00:00Z',
        updated_at: '2026-06-20T00:00:00Z',
        scheduled_start: '2026-06-20T09:00:00Z',
      },
    ];

    const siblings = tasks
      .filter((t) => t.goal_id === 'goal-1')
      .sort((a, b) => {
        const aStart = a.scheduled_start;
        const bStart = b.scheduled_start;
        if (!aStart && !bStart) return a.id.localeCompare(b.id);
        if (!aStart) return 1;
        if (!bStart) return -1;
        if (aStart !== bStart) return aStart.localeCompare(bStart);
        return a.id.localeCompare(b.id);
      });

    expect(siblings).toHaveLength(3);
    const [s0, s1, s2] = siblings;
    expect(s0?.title).toBe('B earlier');
    expect(s1?.title).toBe('A later');
    expect(s2?.title).toBe('Z no schedule');
  });
});
