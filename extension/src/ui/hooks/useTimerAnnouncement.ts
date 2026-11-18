import { useEffect, useRef, useState } from "react";
import type { TimerPhase, TimerState } from "@/features/timer/types";

const PHASE_MESSAGE: Record<TimerPhase, string> = {
  idle: "Timer stopped",
  work: "Focus block started",
  shortBreak: "Short break started",
  longBreak: "Long break started",
};

export function useTimerAnnouncement(
  timer: TimerState,
  ready: boolean,
  awaitingStart: boolean,
): string {
  const prev = useRef<{
    phase: TimerPhase;
    paused: boolean;
    awaitingStart: boolean;
  } | null>(null);
  const [message, setMessage] = useState("");
  const paused = timer.pausedAt !== null;

  useEffect(() => {
    if (!ready) return;
    const before = prev.current;
    prev.current = { phase: timer.phase, paused, awaitingStart };
    if (!before) return;
    if (awaitingStart && !before.awaitingStart)
      setMessage("Ready for the next block");
    else if (before.phase !== timer.phase)
      setMessage(PHASE_MESSAGE[timer.phase]);
    else if (before.awaitingStart && !awaitingStart)
      setMessage(paused ? "Paused" : "Focus block started");
    else if (before.paused !== paused)
      setMessage(paused ? "Paused" : "Resumed");
  }, [ready, timer.phase, paused, awaitingStart]);

  return message;
}
