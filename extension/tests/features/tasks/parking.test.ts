import { describe, expect, it } from "vitest";
import {
  MIN_PARK_MS,
  parkedFrom,
  resumePlan,
  savedTaskCaption,
  sortSavedTasks,
} from "@/features/tasks/parking";
import type { TimerConfig, TimerState } from "@/features/timer/types";
import type { Task } from "@/shared/types";

const MIN = 60_000;
const NOW = 1_700_000_000_000;
const config: TimerConfig = {
  workMinutes: 25,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
  blocksPerLongBreak: 4,
};

const task = (overrides: Partial<Task> & { id: string }): Task => ({
  title: overrides.id,
  steps: [],
  createdAt: 0,
  doneAt: null,
  ...overrides,
});

describe("parkedFrom", () => {
  it("returns null when idle", () => {
    const idle: TimerState = {
      phase: "idle",
      phaseEndsAt: 0,
      blocksCompleted: 0,
      pausedAt: null,
    };
    expect(parkedFrom(idle, config, NOW)).toBeNull();
  });

  it("saves the time left in a running work block", () => {
    const work: TimerState = {
      phase: "work",
      phaseEndsAt: NOW + 18 * MIN,
      blocksCompleted: 2,
      pausedAt: null,
    };
    expect(parkedFrom(work, config, NOW)).toEqual({
      remainingMs: 18 * MIN,
      blocksCompleted: 2,
      parkedAt: NOW,
    });
  });

  it("measures a paused work block at pausedAt", () => {
    const paused: TimerState = {
      phase: "work",
      phaseEndsAt: NOW + 10 * MIN,
      blocksCompleted: 0,
      pausedAt: NOW - 5 * MIN,
    };
    expect(parkedFrom(paused, config, NOW)?.remainingMs).toBe(15 * MIN);
  });

  it("returns null when less than the minimum parking time is left", () => {
    const almostDone: TimerState = {
      phase: "work",
      phaseEndsAt: NOW + MIN_PARK_MS - 1,
      blocksCompleted: 0,
      pausedAt: null,
    };
    expect(parkedFrom(almostDone, config, NOW)).toBeNull();
  });

  it("saves a full work block and the cycle position for a break", () => {
    const shortBreak: TimerState = {
      phase: "shortBreak",
      phaseEndsAt: NOW + 3 * MIN,
      blocksCompleted: 1,
      pausedAt: null,
    };
    expect(parkedFrom(shortBreak, config, NOW)).toEqual({
      remainingMs: 25 * MIN,
      blocksCompleted: 1,
      parkedAt: NOW,
    });
  });
});

describe("resumePlan", () => {
  it("resumes from the saved time and cycle", () => {
    const t = task({
      id: "t1",
      parked: { remainingMs: 18 * MIN, blocksCompleted: 2, parkedAt: NOW },
    });
    expect(resumePlan(t, config, NOW + MIN)).toEqual({
      endBy: NOW + MIN + 18 * MIN,
      blocksCompleted: 2,
    });
  });

  it("starts a full work block at cycle zero without saved time", () => {
    expect(resumePlan(task({ id: "t1" }), config, NOW)).toEqual({
      endBy: NOW + 25 * MIN,
      blocksCompleted: 0,
    });
  });

  it("treats a null parked value as no saved time", () => {
    expect(resumePlan(task({ id: "t1", parked: null }), config, NOW)).toEqual({
      endBy: NOW + 25 * MIN,
      blocksCompleted: 0,
    });
  });
});

describe("sortSavedTasks", () => {
  const tasks = [
    task({ id: "old", createdAt: 50 }),
    task({ id: "recent", createdAt: 1, lastActiveAt: 10 }),
    task({ id: "running", createdAt: 2 }),
    task({ id: "doneEarly", createdAt: 3, doneAt: 50 }),
    task({ id: "doneLate", createdAt: 4, doneAt: 90 }),
  ];

  it("lists open tasks by last activity, falling back to creation time", () => {
    const { open } = sortSavedTasks(tasks, "running");
    expect(open.map((t) => t.id)).toEqual(["old", "recent"]);
  });

  it("excludes the active task from both lists", () => {
    const { open, done } = sortSavedTasks(tasks, "running");
    const ids = [...open, ...done].map((t) => t.id);
    expect(ids).not.toContain("running");
  });

  it("lists done tasks by finish time, latest first, outside the open list", () => {
    const { open, done } = sortSavedTasks(tasks, null);
    expect(done.map((t) => t.id)).toEqual(["doneLate", "doneEarly"]);
    expect(open.some((t) => t.doneAt !== null)).toBe(false);
  });
});

describe("savedTaskCaption", () => {
  const task = (parked: Task["parked"]): Task => ({
    id: "t",
    title: "T",
    steps: [
      { id: "a", title: "A", done: true },
      { id: "b", title: "B", done: false },
    ],
    createdAt: 0,
    doneAt: null,
    parked,
  });

  it("shows only steps when nothing is parked", () => {
    expect(savedTaskCaption(task(null), 4)).toBe("1 of 2 steps");
  });

  it("adds the block position when parked", () => {
    expect(
      savedTaskCaption(
        task({ remainingMs: 1000, blocksCompleted: 1, parkedAt: 0 }),
        4,
      ),
    ).toBe("1 of 2 steps · Block 2 of 4");
  });
});
