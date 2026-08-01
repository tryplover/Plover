import { useEffect, useRef, useState } from 'react';

export interface ProgressPop {
  key: number;
  delta: number;
}

const POP_LIFETIME_MS = 1400;

export function useProgressPops(taskId: string | null, enabled: boolean): ProgressPop[] {
  const [pops, setPops] = useState<ProgressPop[]>([]);
  const nextKey = useRef(0);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPops([]);
    if (!enabled || !taskId) return;

    const timeouts = new Set<ReturnType<typeof setTimeout>>();

    const unsubscribe = window.api.on('app-event', (event: unknown) => {
      const appEvent = event as {
        type: string;
        payload?: { task_id?: string | null; progress_delta?: number | null };
      };
      if (appEvent.type !== 'summary.created') return;
      if (appEvent.payload?.task_id !== taskId) return;
      const delta = appEvent.payload?.progress_delta;
      if (typeof delta !== 'number' || delta <= 0) return;

      const key = nextKey.current++;
      setPops((prev) => [...prev, { key, delta }]);
      const timeoutId = setTimeout(() => {
        setPops((prev) => prev.filter((p) => p.key !== key));
        timeouts.delete(timeoutId);
      }, POP_LIFETIME_MS);
      timeouts.add(timeoutId);
    });

    return () => {
      unsubscribe();
      timeouts.forEach(clearTimeout);
    };
  }, [taskId, enabled]);

  return pops;
}
