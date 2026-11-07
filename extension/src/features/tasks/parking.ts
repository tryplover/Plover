import type { TimerConfig, TimerState } from "@/features/timer/types";
import type { ParkedTimer, Task } from "@/shared/types";

export const MIN_PARK_MS = 30_000;

export function parkedFrom(
  timer: TimerState,
  config: TimerConfig,
  nowMs: number,
): ParkedTimer | null {
  if (timer.phase === "idle") return null;
  if (timer.phase === "work") {
    const remainingMs = Math.max(
      0,
      timer.phaseEndsAt - (timer.pausedAt ?? nowMs),
    );
    if (remainingMs < MIN_PARK_MS) return null;
    return {
      remainingMs,
      blocksCompleted: timer.blocksCompleted,
      parkedAt: nowMs,
    };
  }
  return {
    remainingMs: config.workMinutes * 60_000,
    blocksCompleted: timer.blocksCompleted,
    parkedAt: nowMs,
  };
}

export function resumePlan(
  task: Task,
  config: TimerConfig,
  nowMs: number,
): { endBy: number; blocksCompleted: number } {
  return {
    endBy: nowMs + (task.parked?.remainingMs ?? config.workMinutes * 60_000),
    blocksCompleted: task.parked?.blocksCompleted ?? 0,
  };
}

export function sortSavedTasks(
  tasks: Task[],
  activeTaskId: string | null,
): { open: Task[]; done: Task[] } {
  const open = tasks
    .filter((t) => t.doneAt === null && t.id !== activeTaskId)
    .sort(
      (a, b) =>
        (b.lastActiveAt ?? b.createdAt) - (a.lastActiveAt ?? a.createdAt),
    );
  const done = tasks
    .filter((t) => t.doneAt !== null)
    .sort((a, b) => (b.doneAt ?? 0) - (a.doneAt ?? 0));
  return { open, done };
}

export function savedTaskCaption(
  task: Task,
  blocksPerLongBreak: number,
): string {
  const done = task.steps.filter((s) => s.done).length;
  const steps = `${done} of ${task.steps.length} steps`;
  return task.parked
    ? `${steps} · Block ${(task.parked.blocksCompleted % blocksPerLongBreak) + 1} of ${blocksPerLongBreak}`
    : steps;
}
