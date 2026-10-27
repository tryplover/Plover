import { describe, expect, it } from "vitest";
import { findActiveTask, firstOpenStep } from "@/features/tasks/active-step";
import type { Task } from "@/shared/types";

const task = (id: string, done: boolean[]): Task => ({
  id,
  title: id,
  steps: done.map((d, i) => ({ id: `${id}-${i}`, title: `s${i}`, done: d })),
  createdAt: 0,
  doneAt: null,
});

describe("active step helpers", () => {
  const tasks = [task("a", [true, false, false]), task("b", [true])];

  it("finds the active task or undefined", () => {
    expect(findActiveTask(tasks, "b")?.id).toBe("b");
    expect(findActiveTask(tasks, null)).toBeUndefined();
    expect(findActiveTask(tasks, "zzz")).toBeUndefined();
  });

  it("returns the first unfinished step", () => {
    expect(firstOpenStep(tasks[0])?.id).toBe("a-1");
    expect(firstOpenStep(tasks[1])).toBeUndefined();
    expect(firstOpenStep(undefined)).toBeUndefined();
  });
});
