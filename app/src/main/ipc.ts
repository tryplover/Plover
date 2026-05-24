import { ipcMain, BrowserWindow } from 'electron';
<<<<<<< HEAD
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

=======
import { ProposedPlan } from '../preload/index';
import { Goal, Task } from '../shared/types';

// Simple in-memory store for mocked goals and tasks
const mockGoals: Goal[] = [];
const mockTasks: Task[] = [];

export function registerIpcHandlers(getOverlayWindow: () => BrowserWindow | null): void {
  // Propose goal (decomposition + scheduling)
  ipcMain.handle('goal:propose', async (_event, goalText: string): Promise<ProposedPlan> => {
    // Simulate network/Gemini delay (e.g. 500ms)
    await new Promise((resolve) => setTimeout(resolve, 600));

    const now = new Date();
    const nextWeek = new Date();
    nextWeek.setDate(now.getDate() + 7);

    // Extract deadline if mentioned (very simple regex)
    let deadline = nextWeek.toISOString().split('T')[0];
    if (goalText.toLowerCase().includes('tomorrow')) {
      const tomorrow = new Date();
      tomorrow.setDate(now.getDate() + 1);
      deadline = tomorrow.toISOString().split('T')[0];
    } else if (goalText.toLowerCase().includes('tuesday')) {
      const tuesday = new Date();
      tuesday.setDate(now.getDate() + ((9 - now.getDay()) % 7 || 7));
      deadline = tuesday.toISOString().split('T')[0];
    }

    // Generate mock subtasks based on goal content
    const subtasks: ProposedPlan['subtasks'] = [];
    const titleLower = goalText.toLowerCase();

    if (
      titleLower.includes('essay') ||
      titleLower.includes('paper') ||
      titleLower.includes('write')
    ) {
      subtasks.push(
        {
          title: 'Research and gather sources',
          estimate_minutes: 90,
          depends_on: [],
          scheduled_start: formatSlot(now, 9, 30),
          scheduled_end: formatSlot(now, 11, 0),
        },
        {
          title: 'Create outline and structure',
          estimate_minutes: 60,
          depends_on: ['Research and gather sources'],
          scheduled_start: formatSlot(now, 11, 30),
          scheduled_end: formatSlot(now, 12, 30),
        },
        {
          title: 'Draft introduction and body paragraphs',
          estimate_minutes: 180,
          depends_on: ['Create outline and structure'],
          scheduled_start: formatSlot(now, 14, 0),
          scheduled_end: formatSlot(now, 17, 0),
        },
        {
          title: 'Revise and edit draft',
          estimate_minutes: 60,
          depends_on: ['Draft introduction and body paragraphs'],
          scheduled_start: formatSlot(now, 17, 0),
          scheduled_end: formatSlot(now, 18, 0),
        },
      );
    } else if (
      titleLower.includes('code') ||
      titleLower.includes('build') ||
      titleLower.includes('implement')
    ) {
      subtasks.push(
        {
          title: 'Design architecture and interface',
          estimate_minutes: 60,
          depends_on: [],
          scheduled_start: formatSlot(now, 9, 0),
          scheduled_end: formatSlot(now, 10, 0),
        },
        {
          title: 'Write core implementation code',
          estimate_minutes: 240,
          depends_on: ['Design architecture and interface'],
          scheduled_start: formatSlot(now, 10, 15),
          scheduled_end: formatSlot(now, 14, 15),
        },
        {
          title: 'Write unit and integration tests',
          estimate_minutes: 90,
          depends_on: ['Write core implementation code'],
          scheduled_start: formatSlot(now, 14, 30),
          scheduled_end: formatSlot(now, 16, 0),
        },
        {
          title: 'Refactor and perform code review',
          estimate_minutes: 60,
          depends_on: ['Write unit and integration tests'],
          scheduled_start: formatSlot(now, 16, 15),
          scheduled_end: formatSlot(now, 17, 15),
        },
      );
    } else {
      subtasks.push(
        {
          title: 'Initial planning and scoping',
          estimate_minutes: 45,
          depends_on: [],
          scheduled_start: formatSlot(now, 10, 0),
          scheduled_end: formatSlot(now, 10, 45),
        },
        {
          title: 'Execution of main task',
          estimate_minutes: 120,
          depends_on: ['Initial planning and scoping'],
          scheduled_start: formatSlot(now, 11, 0),
          scheduled_end: formatSlot(now, 13, 0),
        },
        {
          title: 'Final review and verification',
          estimate_minutes: 45,
          depends_on: ['Execution of main task'],
          scheduled_start: formatSlot(now, 14, 0),
          scheduled_end: formatSlot(now, 14, 45),
        },
      );
    }

    return {
      goal: {
        title: goalText,
        description: `Automatically decomposed from: "${goalText}"`,
        deadline,
      },
      subtasks,
    };
  });

  // Commit goal
  ipcMain.handle('goal:commit', async (_event, plan: ProposedPlan): Promise<{ goalId: string }> => {
    // Simulate saving to DB and writing to Google Calendar
    await new Promise((resolve) => setTimeout(resolve, 500));

    const goalId = 'goal_' + Math.random().toString(36).substring(2, 11);
    const createdGoal: Goal = {
      id: goalId,
      title: plan.goal.title,
      description: plan.goal.description,
      deadline: plan.goal.deadline,
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    mockGoals.push(createdGoal);

    plan.subtasks.forEach((task) => {
      const taskId = 'task_' + Math.random().toString(36).substring(2, 11);
      const createdTask: Task = {
        id: taskId,
        goal_id: goalId,
        title: task.title,
        estimate_minutes: task.estimate_minutes,
        depends_on: task.depends_on,
        scheduled_start: task.scheduled_start,
        scheduled_end: task.scheduled_end,
        calendar_event_id: 'cal_' + Math.random().toString(36).substring(2, 11),
        status: 'scheduled',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      mockTasks.push(createdTask);
    });

    console.log(
      `[IPC] Goal committed successfully: ${plan.goal.title} (${plan.subtasks.length} tasks)`,
    );

    // Hide overlay window after commit
>>>>>>> feature/07-overlay-quick-add
    const overlayWin = getOverlayWindow();
    if (overlayWin) {
      overlayWin.hide();
    }

<<<<<<< HEAD
    return { goalId: result.goal.id };
  });

=======
    return { goalId };
  });

  // Close overlay
>>>>>>> feature/07-overlay-quick-add
  ipcMain.handle('overlay:close', async () => {
    const overlayWin = getOverlayWindow();
    if (overlayWin) {
      overlayWin.hide();
    }
  });

<<<<<<< HEAD
=======
  // Resize overlay
>>>>>>> feature/07-overlay-quick-add
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

<<<<<<< HEAD
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
=======
function formatSlot(baseDate: Date, hours: number, minutes: number): string {
  const d = new Date(baseDate);
  d.setHours(hours, minutes, 0, 0);
  return d.toISOString();
>>>>>>> feature/07-overlay-quick-add
}
