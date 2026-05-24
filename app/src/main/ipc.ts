import { ipcMain, BrowserWindow } from 'electron';
import { Goal, Task, CalendarEvent } from '../shared/types.js';
import { goalsRepo, tasksRepo, settingsRepo } from './store/index.js';
import { decomposeGoal } from './planner/decompose.js';
import { scheduleTasks } from './planner/schedule.js';
import { GoogleAuth } from './sync/google-auth.js';
import { GoogleCalendarSync } from './sync/calendar.js';
import { eventBus } from './bus.js';
import { ProposedPlan } from '../preload/index.js';

export const googleAuth = new GoogleAuth();
export const calendarSync = new GoogleCalendarSync(googleAuth);

// Proactively load credentials on startup
void googleAuth.loadSavedCredentials();

export function setupIpcHandlers(getOverlayWindow: () => BrowserWindow | null): void {
  const notifyRenderer = (event: any) => {
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) {
        win.webContents.send('app-event', event);
      }
    }
  };

  // Goals
  ipcMain.handle('goals:get', async () => {
    return goalsRepo.list();
  });

  ipcMain.handle('goals:create', async (_, goalInput: Omit<Goal, 'id' | 'created_at' | 'updated_at'>) => {
    const goal = goalsRepo.create(goalInput);
    eventBus.emit('goal.created', goal);
    return goal;
  });

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
    return decomposeGoal({
      goalText,
      now: new Date(),
      workingHours: settings.workingHours,
    });
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
      return saveGoalAndTasksInternal(goalInput, subtaskInputs, scheduledSlots);
    },
  );

  // Settings
  ipcMain.handle('settings:get', async () => {
    return settingsRepo.getAll();
  });

  ipcMain.handle(
    'settings:update',
    async (
      _,
      settings: Partial<{
        googleConnected: boolean;
        workingHours: { start: string; end: string };
        horizonDays: number;
        pauseScheduling: boolean;
      }>,
    ) => {
      settingsRepo.update(settings);
    },
  );

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

  // Overlay API
  ipcMain.handle('goal:propose', async (_event, goalText: string): Promise<ProposedPlan> => {
    const settings = settingsRepo.getAll();
    const result = await decomposeGoal({
      goalText,
      now: new Date(),
      workingHours: settings.workingHours,
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

    const result = await saveGoalAndTasksInternal(plan.goal, plan.subtasks, slotsForSave);

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

  ipcMain.handle('overlay:resize', async (_event, height: number) => {
    const overlayWin = getOverlayWindow();
    if (overlayWin) {
      const bounds = overlayWin.getBounds();
      if (bounds.height !== height) {
        overlayWin.setBounds({
          x: bounds.x,
          y: bounds.y,
          width: bounds.width,
          height: height,
        });
      }
    }
  });
}

async function saveGoalAndTasksInternal(
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
) {
  const goal = goalsRepo.create({
    title: goalInput.title,
    description: goalInput.description || '',
    deadline: goalInput.deadline,
    status: 'active',
  });

  const isGoogleConnected = settingsRepo.getAll().googleConnected;
  const newTasks: Task[] = [];

  const taskIds = subtaskInputs.map(
    (_, idx) => `task_${Math.random().toString(36).substring(2, 11)}_${idx}`,
  );

  for (let index = 0; index < subtaskInputs.length; index++) {
    const taskInput = subtaskInputs[index]!;
    const slot = scheduledSlots.find((s) => s.tempIndex === index);
    const taskId = taskIds[index]!;

    const depends_on: string[] = [];
    if (Array.isArray(taskInput.depends_on)) {
      for (const depStr of taskInput.depends_on) {
        const depIdx = parseInt(depStr, 10);
        if (!isNaN(depIdx) && taskIds[depIdx]) {
          depends_on.push(taskIds[depIdx]!);
        }
      }
    }

    let calendarEventId: string | undefined = undefined;
    if (isGoogleConnected && slot && slot.start && slot.end) {
      try {
        calendarEventId = await calendarSync.createEvent({
          taskId,
          title: taskInput.title,
          start: new Date(slot.start),
          end: new Date(slot.end),
        });
      } catch (err) {
        console.error(`Failed to sync calendar event for task ${taskInput.title}:`, err);
      }
    }

    const task = tasksRepo.create({
      id: taskId,
      goal_id: goal.id,
      title: taskInput.title,
      estimate_minutes: taskInput.estimate_minutes,
      depends_on,
      scheduled_start: slot?.start || undefined,
      scheduled_end: slot?.end || undefined,
      calendar_event_id: calendarEventId,
      status: slot && slot.start ? 'scheduled' : 'todo',
    });

    newTasks.push(task);
  }

  // Emit eventBus events
  eventBus.emit('goal.created', goal);
  for (const t of newTasks) {
    if (t.scheduled_start) {
      eventBus.emit('task.scheduled', t);
    }
  }
  eventBus.emit('calendar.synced');

  return { goal, tasks: newTasks };
}

export function startEventForwarding(): void {
  eventBus.on('goal.created', (goal: Goal) => {
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) {
        win.webContents.send('goal:created', goal);
        win.webContents.send('app-event', { type: 'goal.created', payload: { goalId: goal.id } });
      }
    }
  });

  eventBus.on('goal.updated', (goal: Goal) => {
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) {
        win.webContents.send('goal:updated', goal);
        win.webContents.send('app-event', { type: 'goal.updated', payload: { goalId: goal.id } });
      }
    }
  });

  eventBus.on('task.scheduled', (task: Task) => {
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) {
        win.webContents.send('task:scheduled', task);
        win.webContents.send('app-event', {
          type: 'task.scheduled',
          payload: { taskId: task.id, start: task.scheduled_start!, end: task.scheduled_end! },
        });
      }
    }
  });

  eventBus.on('task.completed', (task: Task) => {
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) {
        win.webContents.send('task:completed', task);
        win.webContents.send('app-event', { type: 'task.completed', payload: { taskId: task.id } });
      }
    }
  });

  eventBus.on('calendar.synced', () => {
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) {
        win.webContents.send('calendar:synced');
        win.webContents.send('app-event', { type: 'calendar.synced', payload: { syncedCount: 0 } });
      }
    }
  });
}

export function setupIpc(getOverlayWindow: () => BrowserWindow | null): void {
  setupIpcHandlers(getOverlayWindow);
  startEventForwarding();
}
