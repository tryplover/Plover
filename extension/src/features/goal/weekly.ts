import type { Session } from "@/shared/types";

export function weekStart(now: number): number {
  const d = new Date(now);
  const sinceMonday = (d.getDay() + 6) % 7;
  return new Date(
    d.getFullYear(),
    d.getMonth(),
    d.getDate() - sinceMonday,
  ).getTime();
}

export function focusedDays(sessions: Session[], now: number): boolean[] {
  const start = new Date(weekStart(now));
  const days = Array.from({ length: 7 }, () => false);
  for (const s of sessions) {
    if (s.phase !== "work" || !s.completed) continue;
    for (let i = 0; i < 7; i++) {
      const from = new Date(
        start.getFullYear(),
        start.getMonth(),
        start.getDate() + i,
      );
      const to = new Date(
        start.getFullYear(),
        start.getMonth(),
        start.getDate() + i + 1,
      );
      if (s.startedAt >= from.getTime() && s.startedAt < to.getTime()) {
        days[i] = true;
        break;
      }
    }
  }
  return days;
}

export function goalProgress(
  sessions: Session[],
  now: number,
  goalDays: number | null,
): { done: number; goal: number; met: boolean; days: boolean[] } | null {
  if (goalDays === null) return null;
  const days = focusedDays(sessions, now);
  const done = days.filter(Boolean).length;
  return { done, goal: goalDays, met: done >= goalDays, days };
}
