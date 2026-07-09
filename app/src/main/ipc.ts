import { ipcMain, BrowserWindow } from 'electron';
import * as fs from 'node:fs';
import { Goal, Task, CalendarEvent } from '../shared/types.js';
import { goalsRepo, tasksRepo, settingsRepo, summariesRepo, activityRepo } from './store/index.js';
import { decomposeGoal } from './planner/decompose.js';
import { scheduleTasks } from './planner/schedule.js';
import { saveGoalAndTasks, startEventForwarding } from './planner/goal-manager.js';
import { GoogleAuth } from './sync/google-auth.js';
import { GoogleCalendarSync } from './sync/calendar.js';
import { eventBus } from './bus.js';
import { ProposedPlan } from '../preload/index.js';
import { createCompanionWindow } from './windows/companion.js';
import { listActiveWindows } from './activity/window-tracker.js';
import {
  getScreenRecordingStatus,
  requestScreenRecording,
} from './permissions/screen-recording.js';
import { SettingsData } from './store/repos/settings.js';

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

  // --- GOALS ---

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
    let recentActivity:
      { kind: string; payload: Record<string, unknown>; ts: string }[] | undefined;
    if (settings.planner_useRecentActivityContext) {
      const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      recentActivity = activityRepo
        .list({ since, limit: 50 })
        .map((r) => ({ kind: r.kind, payload: r.payload, ts: r.ts }));
    }
    return decomposeGoal({
      goalText,
      now: new Date(),
      workingHours: settings.workingHours,
      ...(recentActivity ? { recentActivity } : {}),
    });
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

  // --- TASKS ---

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

  // --- ACTIVITY ---

  ipcMain.handle(
    'activity:list',
    async (
      _,
      args: {
        since?: string;
        until?: string;
        kinds?: string[];
        limit?: number;
        offset?: number;
      },
    ) => activityRepo.list(args ?? {}),
  );

  ipcMain.handle('activity:getById', async (_, id: number) => activityRepo.getById(Number(id)));

  ipcMain.handle('activity:getScreenshot', async (_, id: number) => {
    const row = activityRepo.getById(Number(id));
    if (!row || row.kind !== 'screenshot_captured') return null;
    const filePath = (row.payload as { filePath?: string }).filePath;
    if (!filePath) return null;
    try {
      const bytes = await fs.promises.readFile(filePath);
      return { dataUrl: `data:image/png;base64,${bytes.toString('base64')}` };
    } catch {
      return null;
    }
  });

  ipcMain.handle('activity:purge', async (_, args: { olderThan?: string; ids?: number[] }) => {
    if (args?.ids && args.ids.length > 0) {
      const filePaths = activityRepo
        .getByIds(args.ids.map(Number))
        .filter((r) => r.kind === 'screenshot_captured')
        .map((r) => (r.payload as { filePath?: string }).filePath)
        .filter((p): p is string => typeof p === 'string');

      const result = activityRepo.purge({ ids: args.ids });
      await activityRepo.deleteScreenshotFiles(filePaths);
      return result;
    }

    if (args?.olderThan) {
      const olderThan = args.olderThan;
      const PAGE = 500;
      let offset = 0;
      for (;;) {
        const page = activityRepo.list({
          kinds: ['screenshot_captured'],
          until: olderThan,
          limit: PAGE,
          offset,
        });
        const screenshotPage = page.filter((r) => r.ts < olderThan);
        const filePaths = screenshotPage
          .map((r) => (r.payload as { filePath?: string }).filePath)
          .filter((p): p is string => typeof p === 'string');

        await activityRepo.deleteScreenshotFiles(filePaths);
        if (page.length < PAGE) break;
        offset += PAGE;
      }
      return activityRepo.purge({ olderThan });
    }
    return { deleted: 0 };
  });

  // --- SETTINGS ---

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

  // --- SUMMARIES ---

  ipcMain.handle('summaries:get', async () => {
    return summariesRepo.listAll();
  });

  // --- CALENDAR ---

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

  // --- OVERLAY API ---

  ipcMain.handle('goal:propose', async (_event, goalText: string): Promise<ProposedPlan> => {
    const settings = settingsRepo.getAll();
    let recentActivity:
      { kind: string; payload: Record<string, unknown>; ts: string }[] | undefined;
    if (settings.planner_useRecentActivityContext) {
      const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      recentActivity = activityRepo
        .list({ since, limit: 50 })
        .map((r) => ({ kind: r.kind, payload: r.payload, ts: r.ts }));
    }
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
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));

    let calendarEvents: CalendarEvent[] = [];
    if (settings.googleConnected) {
      try {
        const start = new Date();
        const end = new Date();
        end.setDate(start.getDate() + settings.horizonDays);
        calendarEvents = await calendarSync.listEvents(start, end);
      } catch (err) {
        console.error('[IPC] Failed to list calendar events for overlay propose:', err);
      }
    }

    const slots = await scheduleTasks({
      tasks: mockTasks,
      calendarEvents,
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

    const result = await saveGoalAndTasks(plan.goal, plan.subtasks, slotsForSave, calendarSync);

    const overlayWin = getOverlayWindow();
    if (overlayWin) {
      overlayWin.hide();
    }

    return { goalId: result.goal.id };
  });

  ipcMain.handle('overlay:close', async () => {
    const overlayWin = getOverlayWindow();
    if (overlayWin) {
      overlayWin.hide();
    }
  });

  ipcMain.handle('overlay:resize', async (_event, height: number, width?: number) => {
    const overlayWin = getOverlayWindow();
    if (overlayWin) {
      const bounds = overlayWin.getBounds();
      const newWidth = width ?? bounds.width;
      if (bounds.height !== height || bounds.width !== newWidth) {
        const newX = bounds.x - Math.round((newWidth - bounds.width) / 2);
        overlayWin.setBounds({
          x: newX,
          y: bounds.y,
          width: newWidth,
          height: height,
        });
      }
    }
  });

  let setupWindow: BrowserWindow | null = null;

  ipcMain.handle('overlay:openWindow', async () => {
    if (setupWindow && !setupWindow.isDestroyed()) {
      setupWindow.focus();
      return;
    }
    if (createOverlayWindow) {
      setupWindow = createOverlayWindow('window');
      setupWindow.on('closed', () => {
        setupWindow = null;
      });
      setupWindow.show();
    }
  });

  // --- COMPANION ---

  let companion: BrowserWindow | null = null;
  let companionKind = 'observing';
  let companionActiveTaskId: string | null = null;

  function ensureCompanion(): BrowserWindow {
    if (!companion || companion.isDestroyed()) {
      companion = createCompanionWindow();
      companion.on('closed', () => {
        companion = null;
      });
    }
    return companion;
  }

  ipcMain.handle('companion:show', () => {
    ensureCompanion().show();
  });
  ipcMain.handle('companion:hide', () => {
    companion?.hide();
  });
  ipcMain.handle('companion:resize', (_e, height: number) => {
    const w = ensureCompanion();
    const [width] = w.getSize();
    if (width !== undefined) {
      w.setSize(width, Math.max(56, Math.min(640, Math.round(height))));
    }
  });
  ipcMain.handle('companion:setActiveTask', (_e, taskId: string | null) => {
    companionActiveTaskId = taskId;
    ensureCompanion().webContents.send('companion:activeTask', taskId);
  });
  ipcMain.handle('companion:setState', (_e, kind: string) => {
    companionKind = kind;
    ensureCompanion().webContents.send('companion:state', kind);
  });
  ipcMain.handle('companion:getInitialState', () => ({
    kind: companionKind,
    activeTaskId: companionActiveTaskId,
  }));

  // --- WINDOWS & PERMISSIONS ---

  ipcMain.handle('windows:list', async () => {
    try {
      return await listActiveWindows();
    } catch (err) {
      console.error('[IPC] Failed to list active windows:', err);
      return [];
    }
  });

  ipcMain.handle('overlay:set-ignore-mouse-events', async (_event, ignore: boolean) => {
    const overlayWin = getOverlayWindow();
    if (overlayWin) {
      overlayWin.setIgnoreMouseEvents(ignore, { forward: true });
    }
  });

  ipcMain.handle('overlay:set-tracking', async (_event, tracking: boolean) => {
    const overlayWin = getOverlayWindow();
    if (overlayWin) {
      (overlayWin as BrowserWindow & { isTracking?: boolean }).isTracking = tracking;
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
