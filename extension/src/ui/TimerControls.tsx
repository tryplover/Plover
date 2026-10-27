import { sendCommand } from "@/lib/messages";
import { remainingSeconds } from "@/lib/timer/machine";
import type { TimerState } from "@/lib/timer/types";

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
}: {
  timer: TimerState;
  now: number;
}) {
  const paused = timer.pausedAt !== null;
  return (
    <div className="plover-timer">
      <p className="plover-phase">{PHASE_LABEL[timer.phase]}</p>
      <p className="plover-clock" aria-live="off">
        {formatClock(remainingSeconds(timer, now))}
      </p>
      <div className="plover-row">
        <button
          type="button"
          onClick={() =>
            void sendCommand({ type: paused ? "timer/resume" : "timer/pause" })
          }
        >
          {paused ? "Resume" : "Pause"}
        </button>
        <button
          type="button"
          onClick={() => void sendCommand({ type: "timer/skip" })}
        >
          Skip
        </button>
        <button
          type="button"
          onClick={() => void sendCommand({ type: "timer/stop" })}
        >
          Stop
        </button>
      </div>
    </div>
  );
}
