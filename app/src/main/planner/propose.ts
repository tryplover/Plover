import { Task, CalendarEvent } from '../../shared/types.js';
import { ProposedPlan } from '../../preload/index.js';
import { decomposeGoal } from './decompose.js';
import { scheduleTasks } from './schedule.js';

export interface ProposeGoalPlanInput {
  goalText: string;
  workingHours: { start: string; end: string };
  horizonDays: number;
  googleConnected: boolean;
  recentActivity?: { kind: string; payload: Record<string, unknown>; ts: string }[];
  listCalendarEvents: (start: Date, end: Date) => Promise<CalendarEvent[]>;
}

/**
 * Pure helper logic to propose a goal plan by decomposing it and scheduling subtasks.
 * Extracted from app/src/main/ipc.ts to reduce technical debt.
 */
export async function proposeGoalPlan(input: ProposeGoalPlanInput): Promise<ProposedPlan> {
  const result = await decomposeGoal({
    goalText: input.goalText,
    now: new Date(),
    workingHours: input.workingHours,
    ...(input.recentActivity ? { recentActivity: input.recentActivity } : {}),
  });

  const mockTasks: Task[] = result.subtasks.map((t, idx) => ({
    id: `temp-${idx}`,
    goal_id: 'temp-goal',
    title: t.title,
    estimate_minutes: t.estimate_minutes,
    depends_on: t.depends_on,
    status: 'todo',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }));

  let calendarEvents: CalendarEvent[] = [];
  if (input.googleConnected) {
    try {
      const start = new Date();
      const end = new Date();
      end.setDate(start.getDate() + input.horizonDays);
      calendarEvents = await input.listCalendarEvents(start, end);
    } catch (err) {
      console.error('[proposeGoalPlan] Failed to list calendar events for overlay propose:', err);
    }
  }

  const slots = await scheduleTasks({
    tasks: mockTasks,
    calendarEvents,
    workingHours: input.workingHours,
    horizonDays: input.horizonDays,
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
