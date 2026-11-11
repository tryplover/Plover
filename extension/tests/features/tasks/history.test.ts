import { describe, expect, it } from "vitest";
import {
  formatDuration,
  groupDoneByDay,
  historyTotals,
  taskStats,
} from "@/features/tasks/history";
import type { Session, Task } from "@/shared/types";

const MIN = 60_000;

const task = (id: string, doneAt: number | null): Task => ({
  id,
  title: id,
  steps: [],
  createdAt: 0,
  doneAt,
});

const session = (
  taskId: string | null,
  phase: Session["phase"],
  minutes: number,
  completed: boolean,
): Session => ({
  id: `${taskId}-${phase}-${minutes}-${completed}`,
  taskId,
  phase,
  startedAt: 1000,
  endedAt: 1000 + minutes * MIN,
  completed,
});

describe("taskStats", () => {
  const sessions = [
    session("a", "work", 25, true),
    session("a", "work", 10, false),
    session("a", "shortBreak", 5, true),
    session("b", "work", 25, true),
    session(null, "work", 25, true),
  ];

  it("counts completed work blocks and sums all work time", () => {
    expect(taskStats(task("a", 1), sessions)).toEqual({
      blocks: 1,
      focusMs: 35 * MIN,
    });
  });

  it("subtracts paused time from focus time", () => {
    const paused = { ...session("p", "work", 25, true), pausedMs: 5 * MIN };
    expect(taskStats(task("p", 1), [paused])).toEqual({
      blocks: 1,
      focusMs: 20 * MIN,
    });
    expect(historyTotals([task("p", 1)], [paused]).focusMs).toBe(20 * MIN);
  });

  it("is zero for a task with no sessions", () => {
    expect(taskStats(task("z", 1), sessions)).toEqual({
      blocks: 0,
      focusMs: 0,
    });
  });
});

describe("historyTotals", () => {
  it("sums stats over the done tasks", () => {
    const sessions = [
      session("a", "work", 25, true),
      session("b", "work", 20, false),
      session("c", "work", 25, true),
    ];
    expect(historyTotals([task("a", 1), task("b", 1)], sessions)).toEqual({
      tasks: 2,
      blocks: 1,
      focusMs: 45 * MIN,
    });
  });
});

describe("formatDuration", () => {
  it("formats minutes and hours", () => {
    expect(formatDuration(45 * MIN)).toBe("45 m");
    expect(formatDuration(65 * MIN)).toBe("1 h 5 m");
    expect(formatDuration(120 * MIN)).toBe("2 h 0 m");
    expect(formatDuration(30_000)).toBe("0 m");
  });
});

describe("groupDoneByDay", () => {
  const now = new Date(2026, 10, 8, 0, 30).getTime();
  const at = (y: number, m: number, d: number, h: number, min = 0) =>
    new Date(y, m, d, h, min).getTime();

  it("groups by local day across midnight, newest first", () => {
    const tasks = [
      task("yesterdayLate", at(2026, 10, 7, 23, 59)),
      task("todayEarly", at(2026, 10, 8, 0, 1)),
      task("yesterdayMorning", at(2026, 10, 7, 9)),
      task("open", null),
      task("older", at(2026, 10, 5, 12)),
    ];
    const groups = groupDoneByDay(tasks, now);
    expect(groups.map((g) => g.label)).toEqual([
      "Today",
      "Yesterday",
      new Date(2026, 10, 5).toLocaleDateString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
      }),
    ]);
    expect(groups.map((g) => g.tasks.map((t) => t.id))).toEqual([
      ["todayEarly"],
      ["yesterdayLate", "yesterdayMorning"],
      ["older"],
    ]);
  });

  it("adds the year for other years", () => {
    const groups = groupDoneByDay([task("old", at(2025, 11, 25, 12))], now);
    expect(groups[0]?.label).toBe(
      new Date(2025, 11, 25).toLocaleDateString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
      }),
    );
  });
});
