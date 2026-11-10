import type { TimerState, TimerTransition } from "@/features/timer/types";
import type { Session, Transient } from "@/shared/types";

export interface BookkeepingInput {
  phaseStartedAt: number | null;
  activeTaskId: string | null;
  hasOpenStep: boolean;
  sessions: Session[];
  transient: Transient;
}

export interface Bookkeeping {
  phaseStartedAt: number | null;
  sessions: Session[];
  transient: Transient;
}

export function bookkeep(
  prev: TimerState,
  t: TimerTransition,
  stored: BookkeepingInput,
  nowMs: number,
  newId: () => string,
): Bookkeeping {
  const completedBlock = t.events.some(
    (e) => e.type === "work-block-completed",
  );
  const stopped = t.events.some((e) => e.type === "stopped");
  const phaseStarted = t.events.some((e) => e.type === "phase-started");

  const sessions = [...stored.sessions];
  if (prev.phase === "work" && t.state.phase !== "work") {
    sessions.push({
      id: newId(),
      taskId: stored.activeTaskId,
      phase: "work",
      startedAt: stored.phaseStartedAt ?? nowMs,
      endedAt: completedBlock ? prev.phaseEndsAt : (prev.pausedAt ?? nowMs),
      completed: completedBlock,
    });
  }

  let phaseStartedAt = stored.phaseStartedAt;
  if (t.state.phase === "idle") {
    phaseStartedAt = null;
  } else if (phaseStarted) {
    phaseStartedAt = nowMs;
  }

  let transient = stored.transient;
  if (completedBlock && stored.hasOpenStep) {
    transient = {
      ...transient,
      checkInPending: true,
      checkInTaskId: stored.activeTaskId,
    };
  } else if (stopped) {
    transient = { ...transient, checkInPending: false };
  }

  return { phaseStartedAt, sessions, transient };
}
