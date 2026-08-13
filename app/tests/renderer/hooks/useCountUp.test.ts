// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCountUp } from '../../../src/renderer/hooks/useCountUp';

// Drives requestAnimationFrame manually so the easing is stepped
// deterministically instead of depending on real frame timing.
let now = 0;
let queue: ((t: number) => void)[] = [];

function flushFrames(toMs: number, stepMs = 16) {
  while (now < toMs) {
    now += stepMs;
    const pending = queue;
    queue = [];
    act(() => {
      pending.forEach((cb) => cb(now));
    });
  }
}

describe('useCountUp', () => {
  beforeEach(() => {
    now = 0;
    queue = [];
    vi.stubGlobal('performance', { now: () => now });
    vi.stubGlobal('requestAnimationFrame', (cb: (t: number) => void) => {
      queue.push(cb);
      return queue.length;
    });
    vi.stubGlobal('cancelAnimationFrame', () => undefined);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('starts at the target rather than counting up from zero on mount', () => {
    const { result } = renderHook(() => useCountUp(65, 1100));

    expect(result.current).toBe(65);
  });

  it('reaches the new target once the duration has elapsed', () => {
    const { result, rerender } = renderHook(({ v }: { v: number }) => useCountUp(v, 1100), {
      initialProps: { v: 65 },
    });

    rerender({ v: 68 });
    flushFrames(1200);

    expect(result.current).toBe(68);
  });

  it('moves gradually rather than snapping', () => {
    const { result, rerender } = renderHook(({ v }: { v: number }) => useCountUp(v, 1100), {
      initialProps: { v: 0 },
    });

    rerender({ v: 100 });
    flushFrames(100);

    expect(result.current).toBeGreaterThan(0);
    expect(result.current).toBeLessThan(100);
  });

  it('picks a new target up from the current display mid-flight', () => {
    const { result, rerender } = renderHook(({ v }: { v: number }) => useCountUp(v, 1100), {
      initialProps: { v: 0 },
    });

    rerender({ v: 100 });
    flushFrames(200);
    const midFlight = result.current;

    rerender({ v: 50 });
    flushFrames(1500);

    expect(midFlight).toBeGreaterThan(0);
    expect(result.current).toBe(50);
  });
});
