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

export function formatClock(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function TimerControls({
  timer,
  now,
  buddy,
}: {
  timer: TimerState;
  now: number;
  buddy?: ReactNode;
}) {
  const paused = timer.pausedAt !== null;
  return (
    <div className="plover-timer">
      <div className="plover-timer-row">
        <div className="plover-timer-clock">
          <p className="plover-clock" aria-live="off">
            {formatClock(remainingSeconds(timer, now))}
          </p>
          <p className="plover-phase">{PHASE_LABEL[timer.phase]}</p>
        </div>
        {buddy}
      </div>
      <div className="plover-row">
        <button
          type="button"
          className="plover-btn-compact"
          onClick={() =>
            void sendCommand({ type: paused ? "timer/resume" : "timer/pause" })
          }
        >
          {paused ? "Resume" : "Pause"}
        </button>
        <button
          type="button"
          className="plover-btn-text"
          onClick={() => void sendCommand({ type: "timer/skip" })}
        >
          Skip
        </button>
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
