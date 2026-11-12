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
): string {
  const prev = useRef<{ phase: TimerPhase; paused: boolean } | null>(null);
  const [message, setMessage] = useState("");
  const paused = timer.pausedAt !== null;

  useEffect(() => {
    if (!ready) return;
    const before = prev.current;
    prev.current = { phase: timer.phase, paused };
    if (!before) return;
    if (before.phase !== timer.phase) setMessage(PHASE_MESSAGE[timer.phase]);
    else if (before.paused !== paused)
      setMessage(paused ? "Paused" : "Resumed");
  }, [ready, timer.phase, paused]);

  return message;
}
