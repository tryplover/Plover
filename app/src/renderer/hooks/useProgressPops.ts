import { useEffect, useRef, useState } from 'react';

export interface ProgressPop {
  key: number;
  delta: number;
}

// Matches the motion spec: the number counts for ~1.1s, then the beat holds
// ~3s before cooling. The chip's exit animation runs after this window closes.
const POP_LIFETIME_MS = 4100;

export function useProgressPops(
  taskId: string | null,
  enabled: boolean,
  totalSteps: number,
): ProgressPop | null {
  const [pop, setPop] = useState<ProgressPop | null>(null);
  const nextKey = useRef(0);
  // Sub-1% goal deltas are carried rather than dropped: on a long goal a real
  // subtask move can be worth a fraction of a point, and rounding each one to
  // zero would hide progress exactly where the bar already feels most static.
  const carried = useRef(0);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPop(null);
    carried.current = 0;
    if (!enabled || !taskId || totalSteps < 1) return;

    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    const unsubscribe = window.api.on('app-event', (event: unknown) => {
      const appEvent = event as {
        type: string;
        payload?: { task_id?: string | null; progress_delta?: number | null };
      };
      if (appEvent.type !== 'summary.created') return;
      if (appEvent.payload?.task_id !== taskId) return;
      const taskDelta = appEvent.payload?.progress_delta;
      if (typeof taskDelta !== 'number' || taskDelta <= 0) return;

      carried.current += taskDelta / totalSteps;
      const whole = Math.floor(carried.current);
      if (whole < 1) return;
      carried.current -= whole;

      if (timeoutId) clearTimeout(timeoutId);
      // A second delta landing mid-flight folds into the live chip instead of
      // stacking a new one, so the number always converges on the current
      // value rather than replaying a stale one.
      setPop((prev) =>
        prev
          ? { key: prev.key, delta: prev.delta + whole }
          : { key: nextKey.current++, delta: whole },
      );
      timeoutId = setTimeout(() => setPop(null), POP_LIFETIME_MS);
    });

    return () => {
      unsubscribe();
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [taskId, enabled, totalSteps]);

  return pop;
}
