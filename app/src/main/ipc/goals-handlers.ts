import { ipcMain } from 'electron';
import { goalsRepo, activityRepo, settingsRepo } from '../store/index.js';
import { eventBus } from '../bus.js';
import { withAuthRetry } from '../auth/with-auth-retry.js';
import { decomposeGoal } from '../planner/decompose.js';
import { saveGoalAndTasks } from '../planner/goal-manager.js';
import { GoogleCalendarSync } from '../sync/calendar.js';
import { Goal, Task } from '../../shared/types.js';

export function registerGoalsHandlers(calendarSync: GoogleCalendarSync) {
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

  ipcMain.handle('goals:decompose', async (_, goalText: string) => {
    const settings = settingsRepo.getAll();
    let recentActivity: { kind: string; payload: Record<string, unknown>; ts: string }[] | undefined;
    if (settings.planner_useRecentActivityContext) {
      const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      recentActivity = activityRepo
        .list({ since, limit: 50 })
        .map((r) => ({ kind: r.kind, payload: r.payload, ts: r.ts }));
    }
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
      return saveGoalAndTasks(goalInput, subtaskInputs, scheduledSlots, calendarSync);
    },
  );
}
