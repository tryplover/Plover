import { useEffect, useRef, useState } from 'react';

// Eases the displayed number toward `target` rather than snapping. Mounting
// starts at the target so a surface that opens mid-goal doesn't count up from
// zero, and a target arriving mid-flight is picked up from wherever the display
// currently sits instead of restarting.
export function useCountUp(target: number, durationMs: number): number {
  const [display, setDisplay] = useState(target);
  const displayRef = useRef(target);

  useEffect(() => {
    const from = displayRef.current;
    if (from === target) return;

    let frame = 0;
    const start = performance.now();

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      const next = Math.round(from + (target - from) * eased);
      displayRef.current = next;
      setDisplay(next);
      if (t < 1) frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, durationMs]);

  return display;
}
