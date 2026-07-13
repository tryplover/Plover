import { ipcMain, BrowserWindow } from 'electron';
import { ProposedPlan } from '../../preload/index.js';
import { settingsRepo, activityRepo } from '../store/index.js';
import { decomposeGoal } from '../planner/decompose.js';
import { scheduleTasks } from '../planner/schedule.js';
import { saveGoalAndTasks } from '../planner/goal-manager.js';
import { Task, CalendarEvent } from '../../shared/types.js';
import { GoogleCalendarSync } from '../sync/calendar.js';

export function setupOverlayHandlers(
  getOverlayWindow: () => BrowserWindow | null,
  createOverlayWindow: ((variant: 'overlay' | 'window') => BrowserWindow) | undefined,
  calendarSync: GoogleCalendarSync,
): void {
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
}
