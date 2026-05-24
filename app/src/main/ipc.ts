import { ipcMain, BrowserWindow } from 'electron';
import { Goal, Task } from '../shared/types.js';
import { eventBus } from './bus.js';

export interface IpcHandlers {
  goals: {
    create: (goal: Omit<Goal, 'id' | 'created_at' | 'updated_at'>) => Promise<Goal>;
    get: (id: string) => Promise<Goal | null>;
    list: (filter?: { status?: Goal['status'] }) => Promise<Goal[]>;
    update: (id: string, patch: Partial<Goal>) => Promise<Goal>;
  };
  tasks: {
    create: (task: Omit<Task, 'id' | 'created_at' | 'updated_at'>) => Promise<Task>;
    get: (id: string) => Promise<Task | null>;
    listByGoal: (goalId: string) => Promise<Task[]>;
    listScheduledBetween: (start: string, end: string) => Promise<Task[]>;
    update: (id: string, patch: Partial<Task>) => Promise<Task>;
  };
  planner: {
    decompose: (goalText: string) => Promise<{
      goal: Omit<Goal, 'id' | 'created_at' | 'updated_at' | 'status'>;
      subtasks: Omit<
        Task,
        | 'id'
        | 'goal_id'
        | 'status'
        | 'created_at'
        | 'updated_at'
        | 'scheduled_start'
        | 'scheduled_end'
        | 'calendar_event_id'
      >[];
    }>;
    schedule: (input: {
      tasks: Task[];
      horizonDays?: number;
    }) => Promise<{ taskId: string; start: string; end: string }[]>;
  };
  calendar: {
    connect: () => Promise<void>;
    disconnect: () => Promise<void>;
    getConnectionStatus: () => Promise<{ connected: boolean; email?: string }>;
  };
  settings: {
    get: () => Promise<{
      workingHours: { start: string; end: string };
      horizonDays: number;
      pauseScheduling: boolean;
    }>;
    update: (
      settings: Partial<{
        workingHours: { start: string; end: string };
        horizonDays: number;
        pauseScheduling: boolean;
      }>,
    ) => Promise<void>;
  };
  overlay: {
    hide: () => Promise<void>;
  };
}

export function registerIpcHandlers(handlers: IpcHandlers): void {
  ipcMain.handle('goals:create', (_, goal: Omit<Goal, 'id' | 'created_at' | 'updated_at'>) =>
    handlers.goals.create(goal),
  );
  ipcMain.handle('goals:get', (_, id: string) => handlers.goals.get(id));
  ipcMain.handle('goals:list', (_, filter?: { status?: Goal['status'] }) =>
    handlers.goals.list(filter),
  );
  ipcMain.handle('goals:update', (_, id: string, patch: Partial<Goal>) =>
    handlers.goals.update(id, patch),
  );

  ipcMain.handle('tasks:create', (_, task: Omit<Task, 'id' | 'created_at' | 'updated_at'>) =>
    handlers.tasks.create(task),
  );
  ipcMain.handle('tasks:get', (_, id: string) => handlers.tasks.get(id));
  ipcMain.handle('tasks:listByGoal', (_, goalId: string) => handlers.tasks.listByGoal(goalId));
  ipcMain.handle('tasks:listScheduledBetween', (_, start: string, end: string) =>
    handlers.tasks.listScheduledBetween(start, end),
  );
  ipcMain.handle('tasks:update', (_, id: string, patch: Partial<Task>) =>
    handlers.tasks.update(id, patch),
  );

  ipcMain.handle('planner:decompose', (_, goalText: string) =>
    handlers.planner.decompose(goalText),
  );
  ipcMain.handle('planner:schedule', (_, input: { tasks: Task[]; horizonDays?: number }) =>
    handlers.planner.schedule(input),
  );

  ipcMain.handle('calendar:connect', () => handlers.calendar.connect());
  ipcMain.handle('calendar:disconnect', () => handlers.calendar.disconnect());
  ipcMain.handle('calendar:getConnectionStatus', () => handlers.calendar.getConnectionStatus());

  ipcMain.handle('settings:get', () => handlers.settings.get());
  ipcMain.handle(
    'settings:update',
    (
      _,
      settings: Partial<{
        workingHours: { start: string; end: string };
        horizonDays: number;
        pauseScheduling: boolean;
      }>,
    ) => handlers.settings.update(settings),
  );

  ipcMain.handle('overlay:hide', () => handlers.overlay.hide());
}

export function startEventForwarding(): void {
  eventBus.on('goal.created', (goal: Goal) => {
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) {
        win.webContents.send('goal:created', goal);
      }
    }
  });

  eventBus.on('goal.updated', (goal: Goal) => {
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) {
        win.webContents.send('goal:updated', goal);
      }
    }
  });

  eventBus.on('task.scheduled', (task: Task) => {
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) {
        win.webContents.send('task:scheduled', task);
      }
    }
  });

  eventBus.on('task.completed', (task: Task) => {
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) {
        win.webContents.send('task:completed', task);
      }
    }
  });

  eventBus.on('calendar.synced', () => {
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) {
        win.webContents.send('calendar:synced');
      }
    }
  });
}

export function setupIpc(handlers: IpcHandlers): void {
  registerIpcHandlers(handlers);
  startEventForwarding();
}
