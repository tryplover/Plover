import type { Session, Task } from "@/shared/types";

export interface TaskStats {
  blocks: number;
  focusMs: number;
}

export function taskStats(task: Task, sessions: Session[]): TaskStats {
  let blocks = 0;
  let focusMs = 0;
  for (const s of sessions) {
    if (s.taskId !== task.id || s.phase !== "work") continue;
    focusMs += s.endedAt - s.startedAt;
    if (s.completed) blocks += 1;
  }
  return { blocks, focusMs };
}

export function historyTotals(
  doneTasks: Task[],
  sessions: Session[],
): { tasks: number; blocks: number; focusMs: number } {
  const totals = { tasks: doneTasks.length, blocks: 0, focusMs: 0 };
  for (const t of doneTasks) {
    const stats = taskStats(t, sessions);
    totals.blocks += stats.blocks;
    totals.focusMs += stats.focusMs;
  }
  return totals;
}

export function formatDuration(ms: number): string {
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 60) return `${minutes} m`;
  return `${Math.floor(minutes / 60)} h ${minutes % 60} m`;
}

function dayStart(ms: number): number {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function dayLabel(dayMs: number, now: number): string {
  const today = new Date(dayStart(now));
  if (dayMs === today.getTime()) return "Today";
  const yesterday = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate() - 1,
  );
  if (dayMs === yesterday.getTime()) return "Yesterday";
  const date = new Date(dayMs);
  return date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    ...(date.getFullYear() !== today.getFullYear() && { year: "numeric" }),
  });
}

export function groupDoneByDay(
  tasks: Task[],
  now: number,
): { label: string; tasks: Task[] }[] {
  const done = tasks
    .filter((t) => t.doneAt !== null)
    .sort((a, b) => (b.doneAt ?? 0) - (a.doneAt ?? 0));
  const groups: { day: number; label: string; tasks: Task[] }[] = [];
  for (const t of done) {
    const day = dayStart(t.doneAt ?? 0);
    const last = groups[groups.length - 1];
    if (last && last.day === day) last.tasks.push(t);
    else groups.push({ day, label: dayLabel(day, now), tasks: [t] });
  }
  return groups.map(({ label, tasks: list }) => ({ label, tasks: list }));
}
