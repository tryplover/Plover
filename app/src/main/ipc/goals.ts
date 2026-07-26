import { ipcMain, BrowserWindow } from 'electron';
import { Goal, Task } from '../../shared/types.js';
import { goalsRepo, settingsRepo, activityRepo } from '../store/index.js';
import { decomposeGoal } from '../planner/decompose.js';
import { scheduleTasks } from '../planner/schedule.js';
import { saveGoalAndTasks, deleteGoalAndTasks } from '../planner/goal-manager.js';
import { eventBus } from '../events/bus.js';
import { ProposedPlan } from '../../preload/index.js';
import { SettingsData } from '../store/repos/settings.js';
import { withAuthRetry } from '../auth/with-auth-retry.js';

function getRecentActivityContext(settings: SettingsData): { kind: string; payload: Record<string, unknown>; ts: string }[] | undefined {
  if (settings.planner_useRecentActivityContext) {
    const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    return activityRepo
      .list({ since, limit: 50 })
      .map((r) => ({ kind: r.kind, payload: r.payload, ts: r.ts }));
  }
  return undefined;
}

export function registerGoalsHandlers(getOverlayWindow: () => BrowserWindow | null): void {
  ipcMain.handle('goals:get', async () => {
    return goalsRepo.list();
  });

  ipcMain.handle(
    'goals:create',
    async (_, goalInput: Omit<Goal, 'id' | 'created_at' | 'updated_at'>) => {
      const goal = goalsRepo.create(goalInput);
      eventBus.emit('goal.created', goal);
      return goal;
    },
  );

  ipcMain.handle('goals:update', async (_, id: string, patch: Partial<Goal>) => {
    const goal = goalsRepo.update(id, patch);
    eventBus.emit('goal.updated', goal);
    return goal;
  });

  ipcMain.handle('goals:delete', async (_, id: string) => {
    await deleteGoalAndTasks(id);
    return true;
  });

  ipcMain.handle('goals:decompose', async (_, goalText: string) => {
    const settings = settingsRepo.getAll();
    const recentActivity = getRecentActivityContext(settings);
    return withAuthRetry(() =>
      decomposeGoal({
        goalText,
        now: new Date(),
        workingHours: settings.workingHours,
        ...(recentActivity ? { recentActivity } : {}),
      }),
    );
  });

  ipcMain.handle(
    'goals:save',
    async (
      _,
      goalInput: Omit<Goal, 'id' | 'created_at' | 'updated_at' | 'status'>,
      subtaskInputs: Omit<
        Task,
        | 'id'
        | 'goal_id'
        | 'status'
        | 'created_at'
        | 'updated_at'
        | 'scheduled_start'
        | 'scheduled_end'
        | 'calendar_event_id'
      >[],
      scheduledSlots: { tempIndex: number; start: string; end: string }[],
    ) => {
      return saveGoalAndTasks(goalInput, subtaskInputs, scheduledSlots);
    },
  );

  // Overlay API
  ipcMain.handle('goal:propose', async (_event, goalText: string): Promise<ProposedPlan> => {
    const settings = settingsRepo.getAll();
    const recentActivity = getRecentActivityContext(settings);
    const result = await decomposeGoal({
      goalText,
      now: new Date(),
      workingHours: settings.workingHours,
      ...(recentActivity ? { recentActivity } : {}),
    });

    const mockTasks: Task[] = result.subtasks.map((t, idx) => ({
      id: `temp-${idx}`,
      goal_id: 'temp-goal',
      title: t.title,
      estimate_minutes: t.estimate_minutes,
      depends_on: t.depends_on,
      status: 'todo',
      sort_index: idx,
      progress: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));

    const slots = await scheduleTasks({
      tasks: mockTasks,
      workingHours: settings.workingHours,
      horizonDays: settings.horizonDays,
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
  });

  ipcMain.handle('goal:commit', async (_event, plan: ProposedPlan): Promise<{ goalId: string }> => {
    const slotsForSave = plan.subtasks.map((task, idx) => ({
      tempIndex: idx,
      start: task.scheduled_start || '',
      end: task.scheduled_end || '',
    }));

    const result = await saveGoalAndTasks(plan.goal, plan.subtasks, slotsForSave);

    const overlayWin = getOverlayWindow();
    if (overlayWin) {
      overlayWin.hide();
    }

    return { goalId: result.goal.id };
  });
}
