import { contextBridge, ipcRenderer } from 'electron';
import { Goal, Task } from '../shared/types.js';

export interface TendrilApi {
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
  events: {
    onGoalCreated: (callback: (goal: Goal) => void) => () => void;
    onGoalUpdated: (callback: (goal: Goal) => void) => () => void;
    onTaskScheduled: (callback: (task: Task) => void) => () => void;
    onTaskCompleted: (callback: (task: Task) => void) => () => void;
    onCalendarSynced: (callback: () => void) => () => void;
  };
}

const api: TendrilApi = {
  goals: {
    create: (goal) => ipcRenderer.invoke('goals:create', goal),
    get: (id) => ipcRenderer.invoke('goals:get', id),
    list: (filter) => ipcRenderer.invoke('goals:list', filter),
    update: (id, patch) => ipcRenderer.invoke('goals:update', id, patch),
  },
  tasks: {
    create: (task) => ipcRenderer.invoke('tasks:create', task),
    get: (id) => ipcRenderer.invoke('tasks:get', id),
    listByGoal: (goalId) => ipcRenderer.invoke('tasks:listByGoal', goalId),
    listScheduledBetween: (start, end) =>
      ipcRenderer.invoke('tasks:listScheduledBetween', start, end),
    update: (id, patch) => ipcRenderer.invoke('tasks:update', id, patch),
  },
  planner: {
    decompose: (goalText) => ipcRenderer.invoke('planner:decompose', goalText),
    schedule: (input) => ipcRenderer.invoke('planner:schedule', input),
  },
  calendar: {
    connect: () => ipcRenderer.invoke('calendar:connect'),
    disconnect: () => ipcRenderer.invoke('calendar:disconnect'),
    getConnectionStatus: () => ipcRenderer.invoke('calendar:getConnectionStatus'),
  },
  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    update: (settings) => ipcRenderer.invoke('settings:update', settings),
  },
  overlay: {
    hide: () => ipcRenderer.invoke('overlay:hide'),
  },
  events: {
    onGoalCreated: (callback) => {
      const listener = (_event: unknown, goal: Goal) => callback(goal);
      ipcRenderer.on('goal:created', listener);
      return () => {
        ipcRenderer.off('goal:created', listener);
      };
    },
    onGoalUpdated: (callback) => {
      const listener = (_event: unknown, goal: Goal) => callback(goal);
      ipcRenderer.on('goal:updated', listener);
      return () => {
        ipcRenderer.off('goal:updated', listener);
      };
    },
    onTaskScheduled: (callback) => {
      const listener = (_event: unknown, task: Task) => callback(task);
      ipcRenderer.on('task:scheduled', listener);
      return () => {
        ipcRenderer.off('task:scheduled', listener);
      };
    },
    onTaskCompleted: (callback) => {
      const listener = (_event: unknown, task: Task) => callback(task);
      ipcRenderer.on('task:completed', listener);
      return () => {
        ipcRenderer.off('task:completed', listener);
      };
    },
    onCalendarSynced: (callback) => {
      const listener = () => callback();
      ipcRenderer.on('calendar:synced', listener);
      return () => {
        ipcRenderer.off('calendar:synced', listener);
      };
    },
  },
};

contextBridge.exposeInMainWorld('api', api);

declare global {
  interface Window {
    api: TendrilApi;
  }
}
