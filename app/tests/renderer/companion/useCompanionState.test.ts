// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
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
      getTasksByGoal: vi.fn(() => Promise.resolve([] as Task[])),
      companion: {
        getInitialState: vi.fn(() => Promise.resolve({ kind: 'observing' as const })),
      },
    },
    triggerEvent: (channel: string, data: unknown) => {
      const listener = onListeners.get(channel);
      if (listener) listener(data);
    },
  };
});

vi.stubGlobal('api', mockWindowApi.api);

function makeTask(overrides: Partial<Task> & { id: string; goal_id: string }): Task {
  return {
    title: 'Untitled',
    estimate_minutes: 30,
    sort_index: 0,
    progress: 0,
    status: 'todo',
    created_at: '2026-06-20T00:00:00Z',
    updated_at: '2026-06-20T00:00:00Z',
    ...overrides,
  };
}

describe('useCompanionState', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockWindowApi.api.companion.getInitialState.mockResolvedValue({ kind: 'observing' });
    mockWindowApi.api.getTasks.mockResolvedValue([]);
    mockWindowApi.api.getTasksByGoal.mockResolvedValue([]);
  });

  it('picks the current task and builds steps/progress on mount', async () => {
    const tasks: Task[] = [
      makeTask({
        id: 'task-1',
        goal_id: 'goal-1',
        title: 'First step',
        status: 'done',
        scheduled_start: '2026-06-20T09:00:00Z',
      }),
      makeTask({
        id: 'task-2',
        goal_id: 'goal-1',
        title: 'Second step',
        status: 'todo',
        scheduled_start: '2026-06-20T10:00:00Z',
      }),
    ];
    mockWindowApi.api.getTasks.mockResolvedValue(tasks);
    mockWindowApi.api.getTasksByGoal.mockResolvedValue(tasks);

    const { result } = renderHook(() => useCompanionState());

    await waitFor(() => {
      expect(result.current.task?.id).toBe('task-2');
    });

    expect(result.current.steps).toHaveLength(2);
    expect(result.current.progress).toBe(0.5);
    const [s0, s1] = result.current.steps;
    expect(s0?.done).toBe(true);
    expect(s1?.current).toBe(true);
  });

  it('reports no task when there are no tasks', async () => {
    mockWindowApi.api.getTasks.mockResolvedValue([]);

    const { result } = renderHook(() => useCompanionState());

    await waitFor(() => {
      expect(mockWindowApi.api.getTasks).toHaveBeenCalled();
    });

    expect(result.current.task).toBeNull();
    expect(result.current.steps).toEqual([]);
    expect(result.current.progress).toBe(0);
  });

  it('updates kind when a companion:state event fires', async () => {
    const { result } = renderHook(() => useCompanionState());

    await waitFor(() => {
      expect(result.current.kind).toBe('observing');
    });

    mockWindowApi.triggerEvent('companion:state', 'paused');

    await waitFor(() => {
      expect(result.current.kind).toBe('paused');
    });
  });

  it('refetches the active task when an app-event task.completed fires', async () => {
    mockWindowApi.api.getTasks.mockResolvedValue([]);

    const { result } = renderHook(() => useCompanionState());

    await waitFor(() => {
      expect(mockWindowApi.api.getTasks).toHaveBeenCalledTimes(1);
    });
    expect(result.current.task).toBeNull();

    const tasks: Task[] = [
      makeTask({
        id: 'task-3',
        goal_id: 'goal-2',
        title: 'New current task',
        status: 'todo',
      }),
    ];
    mockWindowApi.api.getTasks.mockResolvedValue(tasks);
    mockWindowApi.api.getTasksByGoal.mockResolvedValue(tasks);

    mockWindowApi.triggerEvent('app-event', { type: 'task.completed' });

    await waitFor(() => {
      expect(result.current.task?.id).toBe('task-3');
    });
  });

  it('refetches the active task when an app-event task.deleted fires', async () => {
    mockWindowApi.api.getTasks.mockResolvedValue([]);

    const { result } = renderHook(() => useCompanionState());

    await waitFor(() => {
      expect(mockWindowApi.api.getTasks).toHaveBeenCalledTimes(1);
    });
    expect(result.current.task).toBeNull();

    const tasks: Task[] = [
      makeTask({
        id: 'task-4',
        goal_id: 'goal-3',
        title: 'Remaining task',
        status: 'todo',
      }),
    ];
    mockWindowApi.api.getTasks.mockResolvedValue(tasks);
    mockWindowApi.api.getTasksByGoal.mockResolvedValue(tasks);

    mockWindowApi.triggerEvent('app-event', { type: 'task.deleted' });

    await waitFor(() => {
      expect(result.current.task?.id).toBe('task-4');
    });
  });
});
