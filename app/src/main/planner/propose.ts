import { Task } from '../../shared/types.js';
import { ProposedPlan } from '../../preload/index.js';
import { decomposeGoal } from './decompose.js';
import { scheduleTasks } from './schedule.js';

export interface ProposeGoalPlanOptions {
  goalText: string;
  now?: Date;
  workingHours: { start: string; end: string };
  horizonDays: number;
  recentActivity?: { kind: string; payload: Record<string, unknown>; ts: string }[];
}

export async function proposeGoalPlan({
  goalText,
  now = new Date(),
  workingHours,
  horizonDays,
  recentActivity,
}: ProposeGoalPlanOptions): Promise<ProposedPlan> {
  const result = await decomposeGoal({
    goalText,
    now,
    workingHours,
    ...(recentActivity ? { recentActivity } : {}),
  });

  const mockTasks: Task[] = result.subtasks.map((t, idx) => ({
    id: `temp-${idx}`,
    goal_id: 'temp-goal',
    title: t.title,
    estimate_minutes: t.estimate_minutes,
    depends_on: t.depends_on,
    status: 'todo',
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
  }));

  const slots = await scheduleTasks({
    tasks: mockTasks,
    workingHours,
    horizonDays,
  });

  const subtasksWithSlots = result.subtasks.map((t, idx) => {
    const slot = slots.find((s) => s.taskId === `temp-${idx}`);
    return {
      title: t.title,
      estimate_minutes: t.estimate_minutes,
      depends_on: t.depends_on || [],
      scheduled_start: slot?.start.toISOString(),
      scheduled_end: slot?.end.toISOString(),
    };
  });

  return {
    goal: result.goal,
    subtasks: subtasksWithSlots,
  };
}
