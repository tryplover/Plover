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
      focusMs: inDay.reduce((sum, s) => sum + focusMs(s), 0),
      pomodoros: inDay.filter((s) => s.completed).length,
    });
  }
  return out;
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

export function vaultSearch(tasks: Task[], query: string): Task[] {
  const done = tasks.filter((t) => t.doneAt !== null);
  const q = query.trim().toLowerCase();
  if (q === "") return done;
  return done.filter(
    (t) =>
      t.title.toLowerCase().includes(q) ||
      t.steps.some((s) => s.title.toLowerCase().includes(q)),
  );
}
