import type { TimerState, TimerTransition } from "@/features/timer/types";
import type { Session, Transient } from "@/shared/types";

const MIN_SESSION_MS = 1000;

export interface BookkeepingInput {
  phaseStartedAt: number | null;
  activeTaskId: string | null;
  activeTaskTitle: string | null;
  cycleId: string | null;
  phasePausedMs: number;
  sessions: Session[];
  transient: Transient;
}

export interface Bookkeeping {
  phaseStartedAt: number | null;
  cycleId: string | null;
  phasePausedMs: number;
  sessions: Session[];
  transient: Transient;
}

export function bookkeep(
  prev: TimerState,
  t: TimerTransition,
  stored: BookkeepingInput,
  nowMs: number,
  newId: () => string,
  reason?: "skip",
): Bookkeeping {
  const completedBlock = t.events.some(
    (e) => e.type === "work-block-completed",
  );
  const stopped = t.events.some((e) => e.type === "stopped");
  const phaseStarted = t.events.some((e) => e.type === "phase-started");

  const sessions = [...stored.sessions];
  if (prev.phase !== "idle" && (t.state.phase !== prev.phase || phaseStarted)) {
    const completed =
      prev.phase === "work"
        ? completedBlock
        : reason !== "skip" && !stopped && t.state.phase !== "idle";
    const startedAt = stored.phaseStartedAt ?? nowMs;
    const endedAt = completed ? prev.phaseEndsAt : (prev.pausedAt ?? nowMs);
    const tooShort =
      !completed &&
      stored.phaseStartedAt !== null &&
      endedAt - startedAt < MIN_SESSION_MS;
    if (!tooShort)
      sessions.push({
        id: newId(),
        taskId: stored.activeTaskId,
        phase: prev.phase,
        startedAt,
        endedAt,
        completed,
        cycleId: stored.cycleId ?? undefined,
        pausedMs: stored.phasePausedMs,
        taskTitle: stored.activeTaskTitle,
        ...(reason === "skip" && { skipped: true }),
      });
  }

  let cycleId = stored.cycleId;
  if (t.state.phase === "idle") cycleId = null;
  else if (prev.phase === "idle") cycleId = newId();

  let phasePausedMs = stored.phasePausedMs;
  if (t.state.phase === "idle" || phaseStarted) phasePausedMs = 0;

  let phaseStartedAt = stored.phaseStartedAt;
  if (t.state.phase === "idle") {
    phaseStartedAt = null;
  } else if (phaseStarted) {
    phaseStartedAt = nowMs;
  }

  let transient = stored.transient;
  if (completedBlock) {
    transient = {
      ...transient,
      checkInPending: true,
      checkInTaskId: stored.activeTaskId,
    };
  } else if (stopped) {
    transient = { ...transient, checkInPending: false };
  }

  return { phaseStartedAt, cycleId, phasePausedMs, sessions, transient };
}
