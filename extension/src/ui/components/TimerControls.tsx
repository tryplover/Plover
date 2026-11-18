import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { sendCommand } from "@/shared/messages";
import { remainingSeconds } from "@/features/timer/machine";
import type { TimerState } from "@/features/timer/types";

const PHASE_LABEL = {
  idle: "Idle",
  work: "Focus block",
  shortBreak: "Short break",
  longBreak: "Long break",
} as const;

const READY_LABEL = "Ready for the next block?";

export function formatClock(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function TimerControls({
  timer,
  now,
  buddy,
  canPark = false,
  autoFocusPause = false,
  awaitingStart = false,
}: {
  timer: TimerState;
  now: number;
  buddy?: ReactNode;
  canPark?: boolean;
  autoFocusPause?: boolean;
  awaitingStart?: boolean;
}) {
  const paused = timer.pausedAt !== null;
  const pauseRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (autoFocusPause && document.hasFocus()) pauseRef.current?.focus();
  }, [autoFocusPause]);
  useEffect(() => {
    if (awaitingStart && document.hasFocus()) pauseRef.current?.focus();
  }, [awaitingStart]);
  return (
    <div className="plover-timer">
      <div className="plover-timer-row">
        <div className="plover-timer-clock">
          <p className="plover-clock" aria-live="off">
            {formatClock(remainingSeconds(timer, now))}
          </p>
          <p className="plover-phase">
            {awaitingStart ? READY_LABEL : PHASE_LABEL[timer.phase]}
          </p>
        </div>
        {buddy}
      </div>
      <div className="plover-row">
        <button
          ref={pauseRef}
          data-focus-target="timer"
          type="button"
          className="plover-btn-compact"
          onClick={() =>
            void sendCommand({ type: paused ? "timer/resume" : "timer/pause" })
          }
        >
          {awaitingStart ? "Start" : paused ? "Resume" : "Pause"}
        </button>
        {!awaitingStart && (
          <button
            type="button"
            className="plover-btn-text"
            onClick={() => void sendCommand({ type: "timer/skip" })}
          >
            Skip
          </button>
        )}
        {canPark && (
          <button
            type="button"
            className="plover-btn-text"
            onClick={() => void sendCommand({ type: "task/park" })}
          >
            Save for later
          </button>
        )}
        <button
          type="button"
          className="plover-btn-text"
          onClick={() => void sendCommand({ type: "timer/stop" })}
        >
          Stop
        </button>
      </div>
    </div>
  );
}
