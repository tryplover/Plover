import { contextBridge, ipcRenderer } from 'electron';
import { Task, Goal, CalendarEvent } from '../shared/types.js';

export interface ProposedPlan {
  goal: Omit<Goal, 'id' | 'created_at' | 'updated_at' | 'status'>;
  subtasks: {
    title: string;
    estimate_minutes: number;
    depends_on?: string[];
    scheduled_start?: string;
    scheduled_end?: string;
  }[];
}

export type StateKind = 'observing' | 'paused' | 'done' | 'not-sure';

export interface CompanionApi {
  show: () => Promise<void>;
  hide: () => Promise<void>;
  setActiveTask: (taskId: string | null) => Promise<void>;
  setState: (kind: StateKind) => Promise<void>;
  resize: (height: number) => Promise<void>;
  getInitialState: () => Promise<{ kind: StateKind; activeTaskId: string | null }>;
}

export interface PloverApi {
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
    pauseAllTracking: boolean;
    windowTrackingEnabled: boolean;
    gdocsPollingEnabled: boolean;
    fileWatchingEnabled: boolean;
    screenCaptureEnabled: boolean;
    screenCaptureIntervalMinutes: number;
    screenVisionInferenceEnabled: boolean;
    activityRetentionDays: number;
    planner_useRecentActivityContext: boolean;
  }>;
  updateSettings: (
    settings: Partial<{
      googleConnected: boolean;
      workingHours: { start: string; end: string };
      horizonDays: number;
      pauseScheduling: boolean;
      pauseAllTracking: boolean;
      windowTrackingEnabled: boolean;
      gdocsPollingEnabled: boolean;
      fileWatchingEnabled: boolean;
      screenCaptureEnabled: boolean;
      screenCaptureIntervalMinutes: number;
      screenVisionInferenceEnabled: boolean;
      activityRetentionDays: number;
      planner_useRecentActivityContext: boolean;
    }>,
  ) => Promise<void>;

  // Calendar Sync
  connectCalendar: () => Promise<boolean>;
  disconnectCalendar: () => Promise<void>;

  // Overlay Window API
  proposeGoal: (goalText: string) => Promise<ProposedPlan>;
  commitGoal: (plan: ProposedPlan) => Promise<{ goalId: string }>;
  closeOverlay: () => Promise<void>;
  resizeOverlay: (height: number, width?: number) => Promise<void>;
  openSetupWindow: () => Promise<void>;
  listActiveWindows: () => Promise<{ app: string; title: string }[]>;
  setIgnoreMouseEvents: (ignore: boolean) => Promise<void>;
  setTrackingState: (tracking: boolean) => Promise<void>;

  // Activity
  listActivity: (args?: { since?: string; until?: string; kinds?: string[]; limit?: number; offset?: number }) => Promise<{ id: number; ts: string; kind: string; payload: Record<string, unknown> }[]>;
  getActivityById: (id: number) => Promise<{ id: number; ts: string; kind: string; payload: Record<string, unknown> } | null>;
  purgeActivity: (args: { olderThan?: string; ids?: number[] }) => Promise<{ deleted: number }>;
  getScreenshot: (id: number) => Promise<{ dataUrl: string } | null>;

  // Permissions
  getScreenRecordingStatus: () => Promise<'granted' | 'denied' | 'not-determined' | 'restricted' | 'unsupported'>;
  requestScreenRecording: () => Promise<'granted' | 'denied' | 'unsupported'>;

  // Companion API
  companion: CompanionApi;

  // Event Subscription
  on: (channel: string, callback: (...args: unknown[]) => void) => () => void;
}

const api: PloverApi = {
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
  resizeOverlay: (height, width) => ipcRenderer.invoke('overlay:resize', height, width),
  openSetupWindow: () => ipcRenderer.invoke('overlay:openWindow'),
  listActiveWindows: () => ipcRenderer.invoke('windows:list'),
  setIgnoreMouseEvents: (ignore) => ipcRenderer.invoke('overlay:set-ignore-mouse-events', ignore),
  setTrackingState: (tracking) => ipcRenderer.invoke('overlay:set-tracking', tracking),

  // Activity
  listActivity: (args) => ipcRenderer.invoke('activity:list', args ?? {}),
  getActivityById: (id) => ipcRenderer.invoke('activity:getById', id),
  purgeActivity: (args) => ipcRenderer.invoke('activity:purge', args),
  getScreenshot: (id) => ipcRenderer.invoke('activity:getScreenshot', id),

  // Permissions
  getScreenRecordingStatus: () => ipcRenderer.invoke('permissions:screenRecording:status'),
  requestScreenRecording: () => ipcRenderer.invoke('permissions:screenRecording:request'),

  // Companion
  companion: {
    show: () => ipcRenderer.invoke('companion:show'),
    hide: () => ipcRenderer.invoke('companion:hide'),
    setActiveTask: (taskId) => ipcRenderer.invoke('companion:setActiveTask', taskId),
    setState: (kind) => ipcRenderer.invoke('companion:setState', kind),
    resize: (height) => ipcRenderer.invoke('companion:resize', height),
    getInitialState: () => ipcRenderer.invoke('companion:getInitialState'),
  },

  // Events
  on: (channel, callback) => {
    const subscription = (_event: unknown, ...args: unknown[]) => callback(...args);
    ipcRenderer.on(channel, subscription);
    return () => {
      ipcRenderer.off(channel, subscription);
    };
  },
};

contextBridge.exposeInMainWorld('api', api);

declare global {
  interface Window {
    api: PloverApi;
  }
}
