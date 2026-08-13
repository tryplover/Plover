// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useProgressPops } from '../../../src/renderer/hooks/useProgressPops';

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
    },
    triggerEvent: (channel: string, data: unknown) => {
      const listener = onListeners.get(channel);
      if (listener) listener(data);
    },
  };
});

vi.stubGlobal('api', mockWindowApi.api);

function emitDelta(taskId: string, progressDelta: number) {
  act(() => {
    mockWindowApi.triggerEvent('app-event', {
      type: 'summary.created',
      payload: { task_id: taskId, progress_delta: progressDelta },
    });
  });
}

describe('useProgressPops', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('converts a per-task delta to a goal-level one', () => {
    const { result } = renderHook(() => useProgressPops('t1', true, 6));

    emitDelta('t1', 18);

    expect(result.current?.delta).toBe(3);
  });

  it('carries a sub-1% delta instead of showing +0', () => {
    const { result } = renderHook(() => useProgressPops('t1', true, 12));

    emitDelta('t1', 6);

    expect(result.current).toBeNull();
  });

  it('fires once carried deltas cross 1%', () => {
    const { result } = renderHook(() => useProgressPops('t1', true, 12));

    emitDelta('t1', 6);
    expect(result.current).toBeNull();

    emitDelta('t1', 6);
    expect(result.current?.delta).toBe(1);
  });

  it('coalesces a second delta into the live chip rather than stacking', () => {
    const { result } = renderHook(() => useProgressPops('t1', true, 6));

    emitDelta('t1', 18);
    const firstKey = result.current?.key;
    expect(result.current?.delta).toBe(3);

    emitDelta('t1', 12);

    expect(result.current?.delta).toBe(5);
    expect(result.current?.key).toBe(firstKey);
  });

  it('ignores deltas for a different task', () => {
    const { result } = renderHook(() => useProgressPops('t1', true, 6));

    emitDelta('other-task', 60);

    expect(result.current).toBeNull();
  });

  it('drops the carried remainder when the task changes', () => {
    const { result, rerender } = renderHook(
      ({ taskId }: { taskId: string }) => useProgressPops(taskId, true, 12),
      { initialProps: { taskId: 't1' } },
    );

    emitDelta('t1', 6);
    rerender({ taskId: 't2' });
    emitDelta('t2', 6);

    expect(result.current).toBeNull();
  });

  it('does nothing when disabled', () => {
    const { result } = renderHook(() => useProgressPops('t1', false, 6));

    emitDelta('t1', 60);

    expect(result.current).toBeNull();
  });

  it('does nothing when the goal has no steps', () => {
    const { result } = renderHook(() => useProgressPops('t1', true, 0));

    emitDelta('t1', 60);

    expect(result.current).toBeNull();
  });
});
