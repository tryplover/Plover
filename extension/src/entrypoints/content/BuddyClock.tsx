import { useEffect, useState } from "react";
import type { BuddySnapshot } from "@/features/buddy/buddy-state";
import { remainingSeconds } from "@/features/timer/machine";
import { formatClock } from "@/ui/components/TimerControls";

export function BuddyClock({
  clock,
}: {
  clock: NonNullable<BuddySnapshot["clock"]>;
}) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const sync = () => setNow(Date.now());
    const first = setTimeout(sync, 0);
    const id = clock.pausedAt === null ? setInterval(sync, 1000) : undefined;
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [clock.pausedAt, clock.phaseEndsAt]);

  const seconds = remainingSeconds({ ...clock, blocksCompleted: 0 }, now);
  const label = seconds >= 60 ? String(Math.ceil(seconds / 60)) : `${seconds}s`;
  const isWork = clock.phase === "work";
  const paused = clock.pausedAt !== null;
  const aria = `${isWork ? "Focus block" : "Break"}, ${formatClock(seconds)} left${paused ? ", paused" : ""}`;

  return (
    <span
      className={
        "plover-clock " +
        (isWork ? "plover-clock--work" : "plover-clock--break") +
        (paused ? " plover-clock--paused" : "")
      }
      role="timer"
      aria-label={aria}
    >
      <span className="plover-clock__bell plover-clock__bell--l" />
      <span className="plover-clock__bell plover-clock__bell--r" />
      <span className="plover-clock__face">{label}</span>
    </span>
  );
}
