import { describe, it, expect, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useCompanionState } from '../../../src/renderer/companion/useCompanionState';
import type { Task } from '../../../src/shared/types';

const mockWindowApi = vi.hoisted(() => {
  const onListeners: Record<string, (data: unknown) => void> = {};

  return {
    api: {
      on: vi.fn((channel: string, callback: (data: unknown) => void) => {
        onListeners[channel] = callback;
        return () => {
          delete onListeners[channel];
        };
      }),
      getTasks: vi.fn(() => Promise.resolve([] as Task[])),
    },
    triggerEvent: (channel: string, data: unknown) => {
      const listener = onListeners[channel];
      if (listener) listener(data);
    },
  };
});

vi.stubGlobal('api', mockWindowApi.api);

describe('useCompanionState', () => {
  it('starts with observing state and no active task', () => {
    const { result } = renderHook(() => useCompanionState());

    expect(result.current.kind).toBe('observing');
    expect(result.current.task).toBeNull();
    expect(result.current.progress).toBe(0.65);
    expect(result.current.steps).toHaveLength(0);
  });

  it('updates task and builds steps on companion:activeTask event', async () => {
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
    ];

    mockWindowApi.api.getTasks.mockResolvedValueOnce(tasks);

    const { result } = renderHook(() => useCompanionState());

    act(() => {
      mockWindowApi.triggerEvent('companion:activeTask', 'task-1');
    });

    await waitFor(() => {
      expect(result.current.task?.id).toBe('task-1');
    });

    expect(result.current.steps).toHaveLength(2);
    const [step0, step1] = result.current.steps;
    expect(step0).toMatchObject({ id: 'task-1', label: 'First step', done: false, current: true });
    expect(step1).toMatchObject({ id: 'task-2', label: 'Second step', done: false, current: false });
  });

  it('clears task when activeTask is null', async () => {
    mockWindowApi.api.getTasks.mockResolvedValueOnce([]);

    const { result } = renderHook(() => useCompanionState());

    act(() => {
      mockWindowApi.triggerEvent('companion:activeTask', null);
    });

    await waitFor(() => {
      expect(result.current.task).toBeNull();
    });

    expect(result.current.steps).toHaveLength(0);
  });

  it('updates state on companion:state event', async () => {
    const { result } = renderHook(() => useCompanionState());

    act(() => {
      mockWindowApi.triggerEvent('companion:state', 'paused');
    });

    await waitFor(() => {
      expect(result.current.kind).toBe('paused');
    });

    act(() => {
      mockWindowApi.triggerEvent('companion:state', 'done');
    });

    await waitFor(() => {
      expect(result.current.kind).toBe('done');
    });
  });

  it('marks only the active task as current', async () => {
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

    const { result } = renderHook(() => useCompanionState());

    act(() => {
      mockWindowApi.triggerEvent('companion:activeTask', 'task-b');
    });

    await waitFor(() => {
      expect(result.current.task?.id).toBe('task-b');
    });

    const [stepA, stepB, stepC] = result.current.steps;
    expect(stepA).toMatchObject({ id: 'task-a', done: false, current: false });
    expect(stepB).toMatchObject({ id: 'task-b', done: true, current: true });
    expect(stepC).toMatchObject({ id: 'task-c', done: false, current: false });
  });

  it('sorts steps by scheduled_start, falling back to id', async () => {
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

    mockWindowApi.api.getTasks.mockResolvedValueOnce(tasks);

    const { result } = renderHook(() => useCompanionState());

    act(() => {
      mockWindowApi.triggerEvent('companion:activeTask', 'z-no-schedule');
    });

    await waitFor(() => {
      expect(result.current.steps).toHaveLength(3);
    });

    const stepLabels = result.current.steps.map((s) => s.label);
    expect(stepLabels).toEqual(['B earlier', 'A later', 'Z no schedule']);
  });
});
