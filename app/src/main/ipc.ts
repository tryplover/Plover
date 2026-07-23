import { ipcMain, BrowserWindow, screen } from 'electron';
import { Task } from '../shared/types.js';
import { goalsRepo, tasksRepo, settingsRepo, summariesRepo, activityRepo } from './store/index.js';
import { decomposeGoal } from './planner/decompose.js';
import { scheduleTasks } from './planner/schedule.js';
import {
  saveGoalAndTasks,
  startEventForwarding,
  deleteGoalAndTasks,
} from './planner/goal-manager.js';
import { GoogleAuth } from './sync/google-auth.js';
import { eventBus } from './events/bus.js';
import { ProposedPlan } from '../preload/index.js';
import {
  getScreenRecordingStatus,
  requestScreenRecording,
  openScreenRecordingSettings,
} from './permissions/screen-recording.js';
import { SettingsData } from './store/repos/settings.js';
import * as supabaseAuth from './auth/supabase-auth.js';
import { createCompanionWindow } from './windows/companion.js';
import { openWindows } from 'get-windows';

export const googleAuth = new GoogleAuth();

function getRecentActivityContext(
  settings: SettingsData,
): { kind: string; payload: Record<string, unknown>; ts: string }[] | undefined {
  if (settings.planner_useRecentActivityContext) {
    const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    return activityRepo
      .list({ since, limit: 50 })
      .map((r) => ({ kind: r.kind, payload: r.payload, ts: r.ts }));
  }
  return undefined;
}

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
): () => BrowserWindow {
  void googleAuth.loadSavedCredentials();
  void supabaseAuth.restoreSession().then((hasSession) => {
    if (hasSession) supabaseAuth.startAutoRefresh();
  });

  // Goals
  ipcMain.handle('goals:get', async () => {
    return goalsRepo.list();
  });

  ipcMain.handle('goals:delete', async (_, id: string) => {
    await deleteGoalAndTasks(id);
    return true;
  });

  // Tasks
  ipcMain.handle('tasks:get', async () => {
    return tasksRepo.list();
  });

  ipcMain.handle('tasks:getById', async (_, id: string) => {
    return tasksRepo.get(id);
  });

  ipcMain.handle('tasks:getByGoal', async (_, goalId: string) => {
    return tasksRepo.listByGoal(goalId);
  });

  ipcMain.handle('tasks:updateStatus', async (_, id: string, status: Task['status']) => {
    const task = tasksRepo.update(id, { status });
    if (status === 'done') {
      eventBus.emit('task.completed', task);
    }
    return task;
  });

  ipcMain.handle(
    'tasks:create',
    async (_, input: { goal_id: string; title: string; estimate_minutes: number }) => {
      const task = tasksRepo.create({
        goal_id: input.goal_id,
        title: input.title,
        estimate_minutes: input.estimate_minutes,
        status: 'todo',
      });
      eventBus.emit('task.created', { task });
      return task;
    },
  );

  ipcMain.handle(
    'tasks:update',
    async (_, id: string, patch: { title?: string; estimate_minutes?: number }) => {
      const task = tasksRepo.update(id, patch);
      eventBus.emit('task.updated', { task });
      return task;
    },
  );

  ipcMain.handle('tasks:delete', async (_, id: string) => {
    tasksRepo.delete(id);
    return { ok: true as const };
  });

  ipcMain.handle('tasks:reorder', async (_, goal_id: string, orderedIds: string[]) => {
    tasksRepo.reorder(goal_id, orderedIds);
    return { ok: true as const };
  });

  ipcMain.handle('auth:signIn', async () => {
    try {
      await supabaseAuth.signIn();
      const user = await supabaseAuth.getCurrentUser();
      if (!user) {
        throw new Error('Supabase sign-in completed but no user was returned');
      }
      settingsRepo.update({ supabaseUserId: user.id, supabaseUserEmail: user.email });
      const status = { signedIn: true, email: user.email };
      broadcast('auth:status-changed', status);
      return status;
    } catch (err) {
      console.error('[Auth] Sign-in failed:', err);
      throw err;
    }
  });

  ipcMain.handle('auth:signInWithPassword', async (_event, email: string, password: string) => {
    try {
      await supabaseAuth.signInWithPassword(email, password);
      const user = await supabaseAuth.getCurrentUser();
      if (!user) {
        throw new Error('Supabase sign-in completed but no user was returned');
      }
      settingsRepo.update({ supabaseUserId: user.id, supabaseUserEmail: user.email });
      const status = { signedIn: true, email: user.email };
      broadcast('auth:status-changed', status);
      return status;
    } catch (err) {
      console.error('[Auth] Password sign-in failed:', err);
      throw err;
    }
  });

  ipcMain.handle('auth:signUp', async (_event, email: string, password: string) => {
    try {
      const { needsEmailConfirmation } = await supabaseAuth.signUp(email, password);
      if (needsEmailConfirmation) {
        return { signedIn: false, email, needsEmailConfirmation: true };
      }
      const user = await supabaseAuth.getCurrentUser();
      if (!user) {
        throw new Error('Supabase sign-up completed but no user was returned');
      }
      settingsRepo.update({ supabaseUserId: user.id, supabaseUserEmail: user.email });
      const status = { signedIn: true, email: user.email, needsEmailConfirmation: false };
      broadcast('auth:status-changed', { signedIn: true, email: user.email });
      return status;
    } catch (err) {
      console.error('[Auth] Sign-up failed:', err);
      throw err;
    }
  });

  ipcMain.handle('auth:signOut', async () => {
    try {
      await supabaseAuth.signOut();
    } catch (err) {
      // Clearing the local session must not be blocked by a failed remote
      // call (e.g. offline) — otherwise the user is stuck "signed in"
      // locally with no way to sign out until connectivity returns.
      console.error('[Auth] Remote Supabase sign-out failed, clearing local session anyway:', err);
    }
    settingsRepo.update({ supabaseUserId: null, supabaseUserEmail: null });
    const status = { signedIn: false, email: null };
    broadcast('auth:status-changed', status);
    return status;
  });

  ipcMain.handle('auth:getStatus', async () => {
    const settings = settingsRepo.getAll();
    return { signedIn: !!settings.supabaseUserId, email: settings.supabaseUserEmail };
  });

  // Settings
  ipcMain.handle('settings:get', async () => {
    return settingsRepo.getAll();
  });

  ipcMain.handle('settings:update', async (_: unknown, patch: Partial<SettingsData>) => {
    settingsRepo.update(patch);
    return settingsRepo.getAll();
  });

  // Summaries
  ipcMain.handle('summaries:get', async () => {
    return summariesRepo.listAll();
  });

  // Google OAuth (for Docs tracking)
  ipcMain.handle('google:connect', async () => {
    try {
      await googleAuth.authorize();
      settingsRepo.update({ googleConnected: true });
      return true;
    } catch (err) {
      console.error('[OAuth] Connection failed:', err);
      return false;
    }
  });

  ipcMain.handle('google:disconnect', async () => {
    await googleAuth.disconnect();
    settingsRepo.update({ googleConnected: false });
  });

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
      sort_index: 0,
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

  ipcMain.handle('overlay:close', async () => {
    const overlayWin = getOverlayWindow();
    if (overlayWin) {
      overlayWin.hide();
    }
  });

  ipcMain.handle('overlay:resize', async (_event, height: number, width?: number) => {
    console.log(`[IPC] overlay:resize received height=${height}, width=${width}`);
    const overlayWin = getOverlayWindow();
    if (overlayWin) {
      const bounds = overlayWin.getBounds();
      const newWidth = width ?? bounds.width;
      if (bounds.height !== height || bounds.width !== newWidth) {
        const newX = bounds.x - Math.round((newWidth - bounds.width) / 2);
        const newY = bounds.y - Math.round((height - bounds.height) / 2);
        overlayWin.setBounds({
          x: newX,
          y: newY,
          width: newWidth,
          height: height,
        });
      }
    }
  });

  ipcMain.handle('permissions:screenRecording:status', () => getScreenRecordingStatus());
  ipcMain.handle('permissions:screenRecording:request', async () => requestScreenRecording());
  ipcMain.handle('permissions:screenRecording:openSettings', async () =>
    openScreenRecordingSettings(),
  );

  ipcMain.handle('window:list-active', async () => {
    try {
      const wins = await openWindows({
        screenRecordingPermission: false,
        accessibilityPermission: false,
      });
      const unique = new Map<string, { app: string; title: string }>();
      for (const w of wins) {
        const app = w.owner?.name || 'Unknown';
        const title = w.title || app;
        const lowerApp = app.toLowerCase();
        if (
          app === 'Unknown' ||
          lowerApp === 'notification center' ||
          lowerApp === 'window server' ||
          lowerApp === 'dock' ||
          lowerApp === 'systemuiserver' ||
          lowerApp === 'loginwindow'
        ) {
          continue;
        }
        const key = `${app}::${title}`;
        if (!unique.has(key)) {
          unique.set(key, { app, title });
        }
      }
      return Array.from(unique.values());
    } catch (err) {
      console.error('Failed to list active windows:', err);
      return [];
    }
  });

  // Companion
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
  ipcMain.handle('companion:resize', (_e, height: number, width?: number) => {
    const w = ensureCompanion();
    const bounds = w.getBounds();
    const nextHeight = Math.max(20, Math.min(640, Math.round(height)));
    const nextWidth =
      width !== undefined ? Math.max(100, Math.min(600, Math.round(width))) : bounds.width;

    if (width !== undefined && nextWidth !== bounds.width) {
      const { workArea } = screen.getPrimaryDisplay();
      const nextX = workArea.x + Math.round((workArea.width - nextWidth) / 2);
      w.setBounds({
        x: nextX,
        y: bounds.y,
        width: nextWidth,
        height: nextHeight,
      });
    } else {
      w.setBounds({
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: nextHeight,
      });
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

  return ensureCompanion;
}

export function setupIpc(getOverlayWindow: () => BrowserWindow | null): () => BrowserWindow {
  const ensureCompanion = setupIpcHandlers(getOverlayWindow);
  startEventForwarding(broadcast);
  return ensureCompanion;
}
