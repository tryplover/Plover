import type { Step, Task } from "@/shared/types";

export function findActiveTask(
  tasks: Task[],
  activeTaskId: string | null,
): Task | undefined {
  return tasks.find((t) => t.id === activeTaskId);
}

export function firstOpenStep(task: Task | undefined): Step | undefined {
  return task?.steps.find((s) => !s.done);
}
