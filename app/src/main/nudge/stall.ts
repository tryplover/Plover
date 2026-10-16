import { Task } from '@shared/types.js';

export interface StallTaskInput {
  goal_id: string;
  status: Task['status'];
  status_changed_at: string;
}

export function findStalledGoalIds(input: {
  now: Date;
  stallMs: number;
  tasks: StallTaskInput[];
}): string[] {
  const byGoal = new Map<string, StallTaskInput[]>();
  for (const task of input.tasks) {
    const bucket = byGoal.get(task.goal_id);
    if (bucket) {
      bucket.push(task);
    } else {
      byGoal.set(task.goal_id, [task]);
    }
  }

  const stalled: string[] = [];
  for (const [goalId, tasks] of byGoal) {
    const hasOpenTask = tasks.some((t) => t.status !== 'done' && t.status !== 'skipped');
    if (!hasOpenTask) {
      continue;
    }
    const lastChangeMs = Math.max(...tasks.map((t) => Date.parse(t.status_changed_at)));
    if (input.now.getTime() - lastChangeMs >= input.stallMs) {
      stalled.push(goalId);
    }
  }
  return stalled;
}
