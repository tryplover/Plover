import type { Task } from "@/shared/types";

export function cloneTask(
  task: Task,
  id: string,
  newStepId: () => string,
  now: number,
): Task {
  return {
    id,
    title: task.title,
    steps: task.steps.map((s) => ({ ...s, id: newStepId(), done: false })),
    createdAt: now,
    doneAt: null,
    parked: null,
    lastActiveAt: now,
  };
}
