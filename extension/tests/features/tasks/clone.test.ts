import { describe, expect, it } from "vitest";
import { cloneTask } from "@/features/tasks/clone";
import type { Task } from "@/shared/types";

const task: Task = {
  id: "t1",
  title: "Write report",
  steps: [
    { id: "a", title: "Outline", done: true },
    { id: "b", title: "Draft", done: false },
  ],
  createdAt: 1,
  doneAt: 5,
  parked: { remainingMs: 10, blocksCompleted: 1, parkedAt: 4 },
  lastActiveAt: 4,
};

describe("cloneTask", () => {
  it("copies title and steps with fresh ids, unticked", () => {
    let n = 0;
    const copy = cloneTask(task, "t2", () => `s${++n}`, 100);
    expect(copy.title).toBe("Write report");
    expect(copy.steps).toEqual([
      { id: "s1", title: "Outline", done: false },
      { id: "s2", title: "Draft", done: false },
    ]);
  });

  it("resets identity and bookkeeping fields", () => {
    const copy = cloneTask(task, "t2", () => "x", 100);
    expect(copy).toMatchObject({
      id: "t2",
      createdAt: 100,
      doneAt: null,
      parked: null,
      lastActiveAt: 100,
    });
  });

  it("does not mutate the original", () => {
    cloneTask(task, "t2", () => "x", 100);
    expect(task.steps[0]).toEqual({ id: "a", title: "Outline", done: true });
    expect(task.doneAt).toBe(5);
  });
});
