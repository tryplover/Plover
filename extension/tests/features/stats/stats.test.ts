import { describe, expect, it } from "vitest";
import {
  paginate,
  cycleTaskTitles,
  dailyFocus,
  focusMs,
  groupCycles,
  inProgressTasks,
  rangeStart,
  summarize,
  toCsv,
  vaultSearch,
} from "@/features/stats/stats";
import type { Session, Task } from "@/shared/types";

const MIN = 60_000;
// Wednesday 2026-11-11 10:00 local
const NOW = new Date(2026, 10, 11, 10, 0).getTime();
const at = (day: number, h: number, m = 0) =>
  new Date(2026, 10, day, h, m).getTime();

function session(over: Partial<Session> & { id: string }): Session {
  return {
    taskId: null,
    phase: "work",
    startedAt: at(11, 9),
    endedAt: at(11, 9, 25),
    completed: true,
    ...over,
  };
}

const task = (
  id: string,
  doneAt: number | null,
  steps: string[] = [],
): Task => ({
  id,
  title: id,
  steps: steps.map((title, i) => ({ id: `${id}-${i}`, title, done: false })),
  createdAt: 0,
  doneAt,
});

describe("focusMs", () => {
  it("is zero for breaks and excludes pauses for work", () => {
    expect(focusMs(session({ id: "b", phase: "shortBreak" }))).toBe(0);
    expect(focusMs(session({ id: "w", pausedMs: 5 * MIN }))).toBe(20 * MIN);
    expect(focusMs(session({ id: "x", pausedMs: 99 * MIN }))).toBe(0);
  });
});

describe("rangeStart", () => {
  it("computes local day and Monday-start week", () => {
    expect(rangeStart("today", NOW)).toBe(at(11, 0));
    expect(rangeStart("week", NOW)).toBe(at(9, 0));
    expect(rangeStart("all", NOW)).toBe(0);
  });

  it("treats Sunday as the end of the week", () => {
    expect(rangeStart("week", at(15, 12))).toBe(at(9, 0));
    expect(rangeStart("week", at(9, 12))).toBe(at(9, 0));
  });
});

describe("summarize", () => {
  const sessions = [
    session({ id: "a", cycleId: "c1" }),
    session({
      id: "b",
      cycleId: "c1",
      phase: "shortBreak",
      startedAt: at(11, 9, 26),
    }),
    session({
      id: "c",
      cycleId: "c1",
      phase: "longBreak",
      startedAt: at(11, 9, 40),
    }),
    session({ id: "d", cycleId: "c2", completed: false, pausedMs: 5 * MIN }),
    session({ id: "e", startedAt: at(2, 9), endedAt: at(2, 10) }),
    session({ id: "f", cycleId: "c3", phase: "shortBreak" }),
  ];
  const tasks = [task("t1", at(11, 9)), task("t2", at(2, 9)), task("t3", null)];

  it("counts sessions, cycles with work and tasks in range", () => {
    expect(summarize(sessions, tasks, at(9, 0), at(12, 0))).toEqual({
      focusMs: 45 * MIN,
      pomodoros: 1,
      shortBreaks: 2,
      longBreaks: 1,
      cycles: 2,
      tasksDone: 1,
    });
  });

  it("counts work on unfinished tasks toward all-time blocks and focus", () => {
    const open = [session({ id: "x", taskId: "open" })];
    expect(
      summarize(open, [task("open", null)], 0, Number.POSITIVE_INFINITY),
    ).toMatchObject({ pomodoros: 1, focusMs: 25 * MIN, tasksDone: 0 });
  });

  it("counts everything for all time", () => {
    const all = summarize(sessions, tasks, 0, Infinity);
    expect(all.cycles).toBe(3);
    expect(all.tasksDone).toBe(2);
  });
});

describe("dailyFocus", () => {
  it("returns oldest-first days with focus and pomodoros", () => {
    const days = dailyFocus(
      [
        session({ id: "a" }),
        session({
          id: "b",
          startedAt: at(10, 9),
          endedAt: at(10, 9, 10),
          completed: false,
        }),
        session({ id: "c", phase: "shortBreak" }),
      ],
      NOW,
    );
    expect(days).toHaveLength(7);
    expect(days[0]?.dayStart).toBe(at(5, 0));
    expect(days[6]?.dayStart).toBe(at(11, 0));
    expect(days[6]).toMatchObject({ focusMs: 25 * MIN, pomodoros: 1 });
    expect(days[5]).toMatchObject({ focusMs: 10 * MIN, pomodoros: 0 });
    expect(days[0]?.focusMs).toBe(0);
    expect(days[6]?.label).toBe(
      new Date(at(11, 0)).toLocaleDateString(undefined, { weekday: "short" }),
    );
  });
});

describe("groupCycles", () => {
  it("groups by cycle id, newest first, with ordered segments", () => {
    const cycles = groupCycles([
      session({
        id: "b",
        cycleId: "c1",
        phase: "shortBreak",
        startedAt: at(11, 9, 25),
        endedAt: at(11, 9, 30),
      }),
      session({ id: "a", cycleId: "c1", taskTitle: "Report" }),
      session({ id: "old", startedAt: at(2, 9), endedAt: at(2, 9, 25) }),
    ]);
    expect(cycles.map((c) => c.id)).toEqual(["c1", "old"]);
    expect(cycles[0]).toMatchObject({
      startedAt: at(11, 9),
      endedAt: at(11, 9, 30),
      focusMs: 25 * MIN,
      pomodoros: 1,
      breaks: 1,
    });
    expect(cycles[0]?.segments.map((s) => s.id)).toEqual(["a", "b"]);
    expect(cycleTaskTitles(cycles[0] as never)).toEqual(["Report"]);
    expect(cycleTaskTitles(cycles[1] as never)).toEqual(["Untitled task"]);
  });
});

describe("toCsv", () => {
  it("writes a header, ISO times and quotes special fields", () => {
    const csv = toCsv([
      session({
        id: "a",
        cycleId: "c1",
        taskTitle: 'Say "hi", ok',
        pausedMs: 1000,
        skipped: true,
      }),
      session({ id: "b", taskTitle: "multi\nline", completed: false }),
    ]).split("\n");
    expect(csv[0]).toBe(
      "cycle_id,phase,task,started_at,ended_at,paused_ms,completed,skipped",
    );
    expect(csv[1]).toBe(
      `c1,work,"Say ""hi"", ok",${new Date(at(11, 9)).toISOString()},${new Date(at(11, 9, 25)).toISOString()},1000,true,true`,
    );
    expect(csv[2]).toBe(`b,work,"multi`);
    expect(csv[3]).toBe(
      `line",${new Date(at(11, 9)).toISOString()},${new Date(at(11, 9, 25)).toISOString()},0,false,false`,
    );
  });
});

describe("vaultSearch", () => {
  const tasks = [
    task("Write Report", 1, ["outline"]),
    task("Email", 2, ["Draft REPORT intro"]),
    task("Other", 3, ["x"]),
    task("Open report", null),
  ];

  it("matches titles and steps case-insensitively among done tasks", () => {
    expect(vaultSearch(tasks, "report").map((t) => t.id)).toEqual([
      "Write Report",
      "Email",
    ]);
  });

  it("returns all done tasks for an empty query", () => {
    expect(vaultSearch(tasks, "").map((t) => t.id)).toEqual([
      "Write Report",
      "Email",
      "Other",
    ]);
  });
});

describe("inProgressTasks", () => {
  const open = (
    id: string,
    over: Partial<Task> = {},
    steps: string[] = [],
  ): Task => ({ ...task(id, null, steps), ...over });

  it("lists only open tasks, parked included, most recently active first", () => {
    const tasks = [
      open("old", { createdAt: 10 }),
      open("recent", { createdAt: 1, lastActiveAt: 50 }),
      open("parked", {
        createdAt: 2,
        lastActiveAt: 30,
        parked: { remainingMs: 1, blocksCompleted: 0, parkedAt: 30 },
      }),
      task("done", 99),
    ];
    expect(inProgressTasks(tasks, "").map((t) => t.id)).toEqual([
      "recent",
      "parked",
      "old",
    ]);
  });

  it("filters by title or step text like vaultSearch", () => {
    const tasks = [
      open("Write Report"),
      open("Email", {}, ["Draft REPORT intro"]),
      open("Other", {}, ["x"]),
      task("Done report", 5),
    ];
    expect(inProgressTasks(tasks, " report ").map((t) => t.id)).toEqual([
      "Write Report",
      "Email",
    ]);
    expect(inProgressTasks(tasks, "nope")).toEqual([]);
  });
});

describe("paginate", () => {
  const items = Array.from({ length: 23 }, (_, i) => i);
  it("returns one page of items and the page count", () => {
    expect(paginate(items, 2, 10)).toEqual({
      items: [10, 11, 12, 13, 14, 15, 16, 17, 18, 19],
      page: 2,
      pages: 3,
    });
    expect(paginate(items, 3, 10).items).toEqual([20, 21, 22]);
  });
  it("clamps out-of-range pages and treats an empty list as one page", () => {
    expect(paginate(items, 9, 10).page).toBe(3);
    expect(paginate(items, 0, 10).page).toBe(1);
    expect(paginate([], 1, 10)).toEqual({ items: [], page: 1, pages: 1 });
  });
});
