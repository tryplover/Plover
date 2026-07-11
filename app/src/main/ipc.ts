import { ipcMain, BrowserWindow } from 'electron';
import { Goal, Task, CalendarEvent } from '../shared/types.js';
import { goalsRepo, tasksRepo, settingsRepo, activityRepo, summariesRepo } from './store/index.js';
import { decomposeGoal } from './planner/decompose.js';
import { scheduleTasks } from './planner/schedule.js';
import { saveGoalAndTasks, startEventForwarding } from './planner/goal-manager.js';
import { GoogleAuth } from './sync/google-auth.js';
import { GoogleCalendarSync } from './sync/calendar.js';
import { eventBus } from './bus.js';
import { listActiveWindows } from './activity/window-tracker.js';
import {
  getScreenRecordingStatus,
  requestScreenRecording,
} from './permissions/screen-recording.js';
import { SettingsData } from './store/repos/settings.js';
import { startSignup } from './auth/signup-flow.js';
import { withAuthRetry } from './auth/with-auth-retry.js';
import { setupOverlayHandlers } from './ipc/overlay-handlers.js';
import { setupCompanionHandlers } from './ipc/companion-handlers.js';

export const googleAuth = new GoogleAuth();
export const calendarSync = new GoogleCalendarSync(googleAuth);

function broadcast(channel: string, payload?: unknown): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      if (payload === undefined) {
        win.webContents.send(channel);
      } else {
        win.webContents.send(channel, payload);
      }
    }
  }
}

export function setupIpcHandlers(
  getOverlayWindow: () => BrowserWindow | null,
  onWatchedFoldersChange?: (folders: string[]) => Promise<void> | void,
  createOverlayWindow?: (variant: 'overlay' | 'window') => BrowserWindow,
): void {
  void googleAuth.loadSavedCredentials();

  // Goals
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

  // Tasks
  ipcMain.handle('tasks:get', async () => {
    return tasksRepo.list();
  });

  ipcMain.handle('tasks:updateStatus', async (_, id: string, status: Task['status']) => {
    const task = tasksRepo.update(id, { status });
    if (status === 'done') {
      eventBus.emit('task.completed', task);
    }
    return task;
  });

  ipcMain.handle('goals:decompose', async (_, goalText: string) => {
    const settings = settingsRepo.getAll();
    let recentActivity:
      { kind: string; payload: Record<string, unknown>; ts: string }[] | undefined;
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

  ipcMain.handle('signup:start', async () => {
    await startSignup();
  });

  ipcMain.handle(
    'tasks:schedule',
    async (
      _,
      tasksInput: Omit<
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
      calendarEvents: CalendarEvent[],
      workingHours: { start: string; end: string },
      horizonDays: number,
    ) => {
      const mockTasks: Task[] = tasksInput.map((t, idx) => ({
        id: `temp-${idx}`,
        goal_id: 'temp-goal',
        title: t.title,
        estimate_minutes: t.estimate_minutes,
        depends_on: t.depends_on,
        status: 'todo',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }));

      const slots = await scheduleTasks({
        tasks: mockTasks,
        calendarEvents,
        workingHours,
        horizonDays,
      });

      return slots.map((s) => ({
        taskId: s.taskId,
        start: s.start.toISOString(),
        end: s.end.toISOString(),
      }));
    },
  );

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

  // Settings
  ipcMain.handle('settings:get', async () => {
    return settingsRepo.getAll();
  });

  ipcMain.handle('settings:update', async (_: unknown, patch: Partial<SettingsData>) => {
    settingsRepo.update(patch);
    return settingsRepo.getAll();
  });

  ipcMain.handle('settings:watched-folders:get', async () => {
    const settings = settingsRepo.getAll();
    return settings.watchedFolders;
  });

  ipcMain.handle('settings:watched-folders:set', async (_, folders: string[]) => {
    settingsRepo.update({ watchedFolders: folders });
    if (onWatchedFoldersChange) {
      await onWatchedFoldersChange(folders);
    }
    return folders;
  });

  // Summaries
  ipcMain.handle('summaries:get', async () => {
    return summariesRepo.listAll();
  });

  // Calendar
  ipcMain.handle('calendar:connect', async () => {
    try {
      await googleAuth.authorize();
      settingsRepo.update({ googleConnected: true });
      eventBus.emit('calendar.synced');
      return true;
    } catch (err) {
      console.error('[OAuth] Connection failed:', err);
      return false;
    }
  });

  ipcMain.handle('calendar:disconnect', async () => {
    await googleAuth.disconnect();
    settingsRepo.update({ googleConnected: false });
  });

  // Delegated handlers
  setupOverlayHandlers(getOverlayWindow, calendarSync, createOverlayWindow);
  setupCompanionHandlers();

  ipcMain.handle('windows:list', async () => {
    try {
      return await listActiveWindows();
    } catch (err) {
      console.error('[IPC] Failed to list active windows:', err);
      return [];
    }
  });

  ipcMain.handle('permissions:screenRecording:status', () => getScreenRecordingStatus());
  ipcMain.handle('permissions:screenRecording:request', async () => requestScreenRecording());
}

export function setupIpc(
  getOverlayWindow: () => BrowserWindow | null,
  onWatchedFoldersChange?: (folders: string[]) => Promise<void> | void,
  createOverlayWindow?: (variant: 'overlay' | 'window') => BrowserWindow,
): void {
  setupIpcHandlers(getOverlayWindow, onWatchedFoldersChange, createOverlayWindow);
  startEventForwarding(broadcast);
}
