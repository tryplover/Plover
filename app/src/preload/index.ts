import { contextBridge, ipcRenderer } from 'electron';
<<<<<<< HEAD
import { Task, Goal, CalendarEvent } from '../shared/types.js';

export interface ProposedPlan {
  goal: Omit<Goal, 'id' | 'created_at' | 'updated_at' | 'status'>;
  subtasks: {
    title: string;
    estimate_minutes: number;
    depends_on: string[];
=======

export interface ProposedPlan {
  goal: {
    title: string;
    description?: string;
    deadline?: string;
  };
  subtasks: {
    title: string;
    estimate_minutes: number;
    depends_on?: string[];
>>>>>>> feature/07-overlay-quick-add
    scheduled_start?: string;
    scheduled_end?: string;
  }[];
}

<<<<<<< HEAD
export interface TendrilApi {
  // Main Goals & Tasks
  getGoals: () => Promise<Goal[]>;
  getTasks: () => Promise<Task[]>;
  updateTaskStatus: (id: string, status: Task['status']) => Promise<Task>;
  decomposeGoal: (goalText: string) => Promise<{
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
  scheduleTasks: (
    tasks: Omit<
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
  ) => Promise<{ taskId: string; start: string; end: string }[]>;
  saveGoalAndTasks: (
    goal: Omit<Goal, 'id' | 'created_at' | 'updated_at' | 'status'>,
    tasks: Omit<
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
  ) => Promise<{ goal: Goal; tasks: Task[] }>;

  // Settings
  getSettings: () => Promise<{
    googleConnected: boolean;
    workingHours: { start: string; end: string };
    horizonDays: number;
    pauseScheduling: boolean;
  }>;
  updateSettings: (
    settings: Partial<{
      googleConnected: boolean;
      workingHours: { start: string; end: string };
      horizonDays: number;
      pauseScheduling: boolean;
    }>,
  ) => Promise<void>;

  // Calendar Sync
  connectCalendar: () => Promise<boolean>;
  disconnectCalendar: () => Promise<void>;

  // Overlay Window API
=======
export interface ElectronAPI {
>>>>>>> feature/07-overlay-quick-add
  proposeGoal: (goalText: string) => Promise<ProposedPlan>;
  commitGoal: (plan: ProposedPlan) => Promise<{ goalId: string }>;
  closeOverlay: () => Promise<void>;
  resizeOverlay: (height: number) => Promise<void>;
<<<<<<< HEAD

  // Event Subscription
  on: (channel: string, callback: (...args: any[]) => void) => () => void;
}

const api: TendrilApi = {
  getGoals: () => ipcRenderer.invoke('goals:get'),
  getTasks: () => ipcRenderer.invoke('tasks:get'),
  updateTaskStatus: (id, status) => ipcRenderer.invoke('tasks:updateStatus', id, status),
  decomposeGoal: (goalText) => ipcRenderer.invoke('goals:decompose', goalText),
  scheduleTasks: (tasks, calendarEvents, workingHours, horizonDays) =>
    ipcRenderer.invoke('tasks:schedule', tasks, calendarEvents, workingHours, horizonDays),
  saveGoalAndTasks: (goal, tasks, scheduledSlots) =>
    ipcRenderer.invoke('goals:save', goal, tasks, scheduledSlots),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  updateSettings: (settings) => ipcRenderer.invoke('settings:update', settings),
  connectCalendar: () => ipcRenderer.invoke('calendar:connect'),
  disconnectCalendar: () => ipcRenderer.invoke('calendar:disconnect'),

  // Overlay
  proposeGoal: (goalText) => ipcRenderer.invoke('goal:propose', goalText),
  commitGoal: (plan) => ipcRenderer.invoke('goal:commit', plan),
  closeOverlay: () => ipcRenderer.invoke('overlay:close'),
  resizeOverlay: (height) => ipcRenderer.invoke('overlay:resize', height),

  // Events
  on: (channel, callback) => {
    const subscription = (_event: unknown, ...args: unknown[]) => callback(...args);
    ipcRenderer.on(channel, subscription);
    return () => {
      ipcRenderer.off(channel, subscription);
=======
  onReset: (callback: () => void) => () => void;
}

const api: ElectronAPI = {
  proposeGoal: (goalText: string) => ipcRenderer.invoke('goal:propose', goalText),
  commitGoal: (plan: ProposedPlan) => ipcRenderer.invoke('goal:commit', plan),
  closeOverlay: () => ipcRenderer.invoke('overlay:close'),
  resizeOverlay: (height: number) => ipcRenderer.invoke('overlay:resize', height),
  onReset: (callback: () => void) => {
    const subscription = () => callback();
    ipcRenderer.on('overlay:reset', subscription);
    return () => {
      ipcRenderer.removeListener('overlay:reset', subscription);
>>>>>>> feature/07-overlay-quick-add
    };
  },
};

contextBridge.exposeInMainWorld('api', api);

declare global {
  interface Window {
<<<<<<< HEAD
    api: TendrilApi;
=======
    api: ElectronAPI;
>>>>>>> feature/07-overlay-quick-add
  }
}
