import type { Session, Task } from "@/shared/types";

export type StatsRange = "today" | "week" | "all";

export interface Summary {
  focusMs: number;
  pomodoros: number;
  shortBreaks: number;
  longBreaks: number;
  cycles: number;
  tasksDone: number;
}

export interface DayFocus {
  label: string;
  dayStart: number;
  dayEnd: number;
  focusMs: number;
  pomodoros: number;
}

export interface Cycle {
  id: string;
  startedAt: number;
  endedAt: number;
  focusMs: number;
  pomodoros: number;
  breaks: number;
  segments: Session[];
}

export function focusMs(s: Session): number {
  if (s.phase !== "work") return 0;
  return Math.max(0, s.endedAt - s.startedAt - (s.pausedMs ?? 0));
}

function startOfDay(ms: number): Date {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function rangeStart(range: StatsRange, now: number): number {
  if (range === "all") return 0;
  const today = startOfDay(now);
  if (range === "today") return today.getTime();
  const sinceMonday = (today.getDay() + 6) % 7;
  return new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate() - sinceMonday,
  ).getTime();
}

export function summarize(
  sessions: Session[],
  tasks: Task[],
  from: number,
  to: number,
): Summary {
  const summary: Summary = {
    focusMs: 0,
    pomodoros: 0,
    shortBreaks: 0,
    longBreaks: 0,
    cycles: 0,
    tasksDone: 0,
  };
  const cycles = new Set<string>();
  for (const s of sessions) {
    if (s.startedAt < from || s.startedAt >= to) continue;
    if (s.phase === "work") {
      summary.focusMs += focusMs(s);
      if (s.completed) summary.pomodoros += 1;
      cycles.add(s.cycleId ?? s.id);
    } else if (s.phase === "shortBreak") {
      summary.shortBreaks += 1;
    } else {
      summary.longBreaks += 1;
    }
  }
  summary.cycles = cycles.size;
  summary.tasksDone = tasks.filter(
    (t) => t.doneAt !== null && t.doneAt >= from && t.doneAt < to,
  ).length;
  return summary;
}

export function dailyFocus(
  sessions: Session[],
  now: number,
  days = 7,
): DayFocus[] {
  const today = startOfDay(now);
  const out: DayFocus[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const day = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate() - i,
    );
    const next = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1);
    const inDay = sessions.filter(
      (s) =>
        s.phase === "work" &&
        s.startedAt >= day.getTime() &&
        s.startedAt < next.getTime(),
    );
    out.push({
      label: day.toLocaleDateString(undefined, { weekday: "short" }),
      dayStart: day.getTime(),
      dayEnd: next.getTime(),
      focusMs: inDay.reduce((sum, s) => sum + focusMs(s), 0),
      pomodoros: inDay.filter((s) => s.completed).length,
    });
  }
  return out;
}

export interface TaskFocus {
  taskId: string | null;
  title: string;
  focusMs: number;
  blocks: number;
}

const UNTITLED = "Untitled task";

export function focusByTask(
  sessions: Session[],
  dayStart: number,
  dayEnd: number,
): TaskFocus[] {
  const groups = new Map<
    string | null,
    { taskId: string | null; focusMs: number; blocks: number; latest: Session }
  >();
  for (const s of sessions) {
    if (s.phase !== "work") continue;
    if (s.startedAt < dayStart || s.startedAt >= dayEnd) continue;
    const g = groups.get(s.taskId);
    if (!g) {
      groups.set(s.taskId, {
        taskId: s.taskId,
        focusMs: focusMs(s),
        blocks: 1,
        latest: s,
      });
      continue;
    }
    g.focusMs += focusMs(s);
    g.blocks += 1;
    if (s.startedAt >= g.latest.startedAt) g.latest = s;
  }
  return [...groups.values()]
    .map((g) => ({
      taskId: g.taskId,
      title: g.taskId === null ? UNTITLED : (g.latest.taskTitle ?? UNTITLED),
      focusMs: g.focusMs,
      blocks: g.blocks,
    }))
    .sort((a, b) => b.focusMs - a.focusMs || a.title.localeCompare(b.title));
}

export function groupCycles(sessions: Session[]): Cycle[] {
  const byId = new Map<string, Session[]>();
  for (const s of sessions) {
    const id = s.cycleId ?? s.id;
    const list = byId.get(id);
    if (list) list.push(s);
    else byId.set(id, [s]);
  }
  const cycles: Cycle[] = [];
  for (const [id, list] of byId) {
    const segments = [...list].sort((a, b) => a.startedAt - b.startedAt);
    cycles.push({
      id,
      startedAt: Math.min(...segments.map((s) => s.startedAt)),
      endedAt: Math.max(...segments.map((s) => s.endedAt)),
      focusMs: segments.reduce((sum, s) => sum + focusMs(s), 0),
      pomodoros: segments.filter((s) => s.phase === "work" && s.completed)
        .length,
      breaks: segments.filter((s) => s.phase !== "work").length,
      segments,
    });
  }
  return cycles.sort((a, b) => b.startedAt - a.startedAt);
}

export function cycleTaskTitles(cycle: Cycle): string[] {
  const titles = new Set<string>();
  for (const s of cycle.segments) {
    if (s.phase === "work") titles.add(s.taskTitle ?? "Untitled task");
  }
  return [...titles];
}

function csvField(value: string): string {
  return /[",\n\r]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

export function toCsv(sessions: Session[]): string {
  const rows = sessions.map((s) =>
    [
      s.cycleId ?? s.id,
      s.phase,
      s.taskTitle ?? "",
      new Date(s.startedAt).toISOString(),
      new Date(s.endedAt).toISOString(),
      String(s.pausedMs ?? 0),
      String(s.completed),
      String(s.skipped ?? false),
    ]
      .map(csvField)
      .join(","),
  );
  return [
    "cycle_id,phase,task,started_at,ended_at,paused_ms,completed,skipped",
    ...rows,
  ].join("\n");
}

function matchesQuery(t: Task, q: string): boolean {
  return (
    q === "" ||
    t.title.toLowerCase().includes(q) ||
    t.steps.some((s) => s.title.toLowerCase().includes(q))
  );
}

export function vaultSearch(tasks: Task[], query: string): Task[] {
  const q = query.trim().toLowerCase();
  return tasks.filter((t) => t.doneAt !== null && matchesQuery(t, q));
}

export function inProgressTasks(tasks: Task[], query: string): Task[] {
  const q = query.trim().toLowerCase();
  return tasks
    .filter((t) => t.doneAt === null && matchesQuery(t, q))
    .sort(
      (a, b) =>
        (b.lastActiveAt ?? b.createdAt) - (a.lastActiveAt ?? a.createdAt),
    );
}

export function paginate<T>(
  items: T[],
  page: number,
  size: number,
): { items: T[]; page: number; pages: number } {
  const pages = Math.max(1, Math.ceil(items.length / size));
  const current = Math.min(Math.max(1, page), pages);
  return {
    items: items.slice((current - 1) * size, current * size),
    page: current,
    pages,
  };
}
