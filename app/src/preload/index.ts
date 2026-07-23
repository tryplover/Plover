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
  resize: (height: number, width?: number) => Promise<void>;
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
  createTask: (input: {
    goal_id: string;
    title: string;
    estimate_minutes: number;
  }) => Promise<Task>;
  updateTask: (id: string, patch: { title?: string; estimate_minutes?: number }) => Promise<Task>;
  deleteTask: (id: string) => Promise<{ ok: true }>;
  reorderTasks: (goal_id: string, orderedIds: string[]) => Promise<{ ok: true }>;

  // Settings
  getSettings: () => Promise<{
    googleConnected: boolean;
    workingHours: { start: string; end: string };
    horizonDays: number;
    pauseScheduling: boolean;
    theme: 'light' | 'dark';
    companionMode: 'full' | 'compact';
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
      theme: 'light' | 'dark';
      companionMode: 'full' | 'compact';
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
    theme: 'light' | 'dark';
    companionMode: 'full' | 'compact';
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

  // Permissions
  getScreenRecordingStatus: () => Promise<
    'granted' | 'denied' | 'not-determined' | 'restricted' | 'unsupported'
  >;
  requestScreenRecording: () => Promise<'granted' | 'denied' | 'unsupported'>;
  openScreenRecordingSettings: () => Promise<void>;

  // Window Controls (Windows)
  platform: string;

  // Companion API
  companion: CompanionApi;

  // Window tracking (Phase 2+ — stub returns empty list until implemented)
  listActiveWindows: () => Promise<{ app: string; title: string }[]>;

  // Plover Account (Supabase) API
  auth: {
    signIn: () => Promise<{ signedIn: boolean; email: string | null }>;
    signInWithPassword: (
      email: string,
      password: string,
    ) => Promise<{ signedIn: boolean; email: string | null }>;
    signUp: (
      email: string,
      password: string,
    ) => Promise<{ signedIn: boolean; email: string | null; needsEmailConfirmation: boolean }>;
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
  createTask: (input) => ipcRenderer.invoke('tasks:create', input),
  updateTask: (id, patch) => ipcRenderer.invoke('tasks:update', id, patch),
  deleteTask: (id) => ipcRenderer.invoke('tasks:delete', id),
  reorderTasks: (goal_id, orderedIds) => ipcRenderer.invoke('tasks:reorder', goal_id, orderedIds),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  updateSettings: (settings) => ipcRenderer.invoke('settings:update', settings),
  connectGoogle: () => ipcRenderer.invoke('google:connect'),
  disconnectGoogle: () => ipcRenderer.invoke('google:disconnect'),

  // Overlay
  proposeGoal: (goalText) => ipcRenderer.invoke('goal:propose', goalText),
  commitGoal: (plan) => ipcRenderer.invoke('goal:commit', plan),
  closeOverlay: () => ipcRenderer.invoke('overlay:close'),
  resizeOverlay: (height, width) => ipcRenderer.invoke('overlay:resize', height, width),

  // Permissions
  getScreenRecordingStatus: () => ipcRenderer.invoke('permissions:screenRecording:status'),
  requestScreenRecording: () => ipcRenderer.invoke('permissions:screenRecording:request'),
  openScreenRecordingSettings: () => ipcRenderer.invoke('permissions:screenRecording:openSettings'),

  // Plover Account (Supabase)
  auth: {
    signIn: () => ipcRenderer.invoke('auth:signIn'),
    signInWithPassword: (email: string, password: string) =>
      ipcRenderer.invoke('auth:signInWithPassword', email, password),
    signUp: (email: string, password: string) => ipcRenderer.invoke('auth:signUp', email, password),
    signOut: () => ipcRenderer.invoke('auth:signOut'),
    getStatus: () => ipcRenderer.invoke('auth:getStatus'),
  },

  platform: process.platform,

  // Companion
  companion: {
    show: () => ipcRenderer.invoke('companion:show'),
    hide: () => ipcRenderer.invoke('companion:hide'),
    setActiveTask: (taskId) => ipcRenderer.invoke('companion:setActiveTask', taskId),
    setState: (kind) => ipcRenderer.invoke('companion:setState', kind),
    resize: (height, width) => ipcRenderer.invoke('companion:resize', height, width),
    getInitialState: () => ipcRenderer.invoke('companion:getInitialState'),
  },

  listActiveWindows: () => Promise.resolve([]),

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
