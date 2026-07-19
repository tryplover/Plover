import { contextBridge, ipcRenderer } from 'electron';
import { Task, Goal, SummaryRow } from '../shared/types.js';

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
  deleteGoal: (id: string) => Promise<boolean>;
  getTasks: () => Promise<Task[]>;
  getTaskById: (id: string) => Promise<Task | null>;
  getTasksByGoal: (goalId: string) => Promise<Task[]>;
  getSummaries: () => Promise<
    (SummaryRow & { task_title: string | null; goal_title: string | null })[]
  >;
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
  ) => Promise<{
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

  // Google OAuth (for Docs tracking)
  connectGoogle: () => Promise<boolean>;
  disconnectGoogle: () => Promise<void>;

  // Overlay Window API
  proposeGoal: (goalText: string) => Promise<ProposedPlan>;
  commitGoal: (plan: ProposedPlan) => Promise<{ goalId: string }>;
  closeOverlay: () => Promise<void>;
  resizeOverlay: (height: number, width?: number) => Promise<void>;
  openSetupWindow: () => Promise<void>;
  listActiveWindows: () => Promise<{ app: string; title: string }[]>;
  setIgnoreMouseEvents: (ignore: boolean) => Promise<void>;
  setTrackingState: (tracking: boolean) => Promise<void>;

  // Permissions
  getScreenRecordingStatus: () => Promise<
    'granted' | 'denied' | 'not-determined' | 'restricted' | 'unsupported'
  >;
  requestScreenRecording: () => Promise<'granted' | 'denied' | 'unsupported'>;
  openScreenRecordingSettings: () => Promise<void>;

  // Companion API
  companion: CompanionApi;

  // Window Controls (Windows)
  platform: string;
  minimizeWindow: () => Promise<void>;
  maximizeWindow: () => Promise<void>;
  closeWindow: () => Promise<void>;

  // Signup API
  signup: {
    start: () => Promise<void>;
    complete: () => Promise<void>;
  };

  // Plover Account (Supabase) API
  auth: {
    signIn: () => Promise<{ signedIn: boolean; email: string | null }>;
    signOut: () => Promise<{ signedIn: boolean; email: string | null }>;
    getStatus: () => Promise<{ signedIn: boolean; email: string | null }>;
  };

  // Event Subscription
  on: (channel: string, callback: (...args: unknown[]) => void) => () => void;
}

const api: PloverApi = {
  getGoals: () => ipcRenderer.invoke('goals:get'),
  deleteGoal: (id) => ipcRenderer.invoke('goals:delete', id),
  getTasks: () => ipcRenderer.invoke('tasks:get'),
  getTaskById: (id) => ipcRenderer.invoke('tasks:getById', id),
  getTasksByGoal: (goalId) => ipcRenderer.invoke('tasks:getByGoal', goalId),
  getSummaries: () => ipcRenderer.invoke('summaries:get'),
  updateTaskStatus: (id, status) => ipcRenderer.invoke('tasks:updateStatus', id, status),
  decomposeGoal: (goalText) => ipcRenderer.invoke('goals:decompose', goalText),
  scheduleTasks: (tasks, workingHours, horizonDays) =>
    ipcRenderer.invoke('tasks:schedule', tasks, workingHours, horizonDays),
  saveGoalAndTasks: (goal, tasks, scheduledSlots) =>
    ipcRenderer.invoke('goals:save', goal, tasks, scheduledSlots),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  updateSettings: (settings) => ipcRenderer.invoke('settings:update', settings),
  connectGoogle: () => ipcRenderer.invoke('google:connect'),
  disconnectGoogle: () => ipcRenderer.invoke('google:disconnect'),

  // Overlay
  proposeGoal: (goalText) => ipcRenderer.invoke('goal:propose', goalText),
  commitGoal: (plan) => ipcRenderer.invoke('goal:commit', plan),
  closeOverlay: () => ipcRenderer.invoke('overlay:close'),
  resizeOverlay: (height, width) => ipcRenderer.invoke('overlay:resize', height, width),
  openSetupWindow: () => ipcRenderer.invoke('overlay:openWindow'),
  listActiveWindows: () => ipcRenderer.invoke('windows:list'),
  setIgnoreMouseEvents: (ignore) => ipcRenderer.invoke('overlay:set-ignore-mouse-events', ignore),
  setTrackingState: (tracking) => ipcRenderer.invoke('overlay:set-tracking', tracking),

  // Permissions
  getScreenRecordingStatus: () => ipcRenderer.invoke('permissions:screenRecording:status'),
  requestScreenRecording: () => ipcRenderer.invoke('permissions:screenRecording:request'),
  openScreenRecordingSettings: () => ipcRenderer.invoke('permissions:screenRecording:openSettings'),

  // Companion
  companion: {
    show: () => ipcRenderer.invoke('companion:show'),
    hide: () => ipcRenderer.invoke('companion:hide'),
    setActiveTask: (taskId) => ipcRenderer.invoke('companion:setActiveTask', taskId),
    setState: (kind) => ipcRenderer.invoke('companion:setState', kind),
    resize: (height) => ipcRenderer.invoke('companion:resize', height),
    getInitialState: () => ipcRenderer.invoke('companion:getInitialState'),
  },

  // Signup
  signup: {
    start: () => ipcRenderer.invoke('signup:start'),
    complete: () => ipcRenderer.invoke('signup:complete'),
  },

  // Plover Account (Supabase)
  auth: {
    signIn: () => ipcRenderer.invoke('auth:signIn'),
    signOut: () => ipcRenderer.invoke('auth:signOut'),
    getStatus: () => ipcRenderer.invoke('auth:getStatus'),
  },

  platform: process.platform,
  minimizeWindow: () => ipcRenderer.invoke('window:minimize'),
  maximizeWindow: () => ipcRenderer.invoke('window:maximize'),
  closeWindow: () => ipcRenderer.invoke('window:close'),

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
