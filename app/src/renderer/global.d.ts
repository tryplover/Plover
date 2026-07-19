import { Goal, Task } from '../shared/types';

export interface PloverAPI {
  getGoals(): Promise<Goal[]>;
  getTasks(): Promise<Task[]>;
  updateTaskStatus(id: string, status: Task['status']): Promise<Task>;
  decomposeGoal(goalText: string): Promise<{
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
  scheduleTasks(
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
  ): Promise<{ taskId: string; start: string; end: string }[]>;
  saveGoalAndTasks(
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
  ): Promise<{ goal: Goal; tasks: Task[] }>;
  getSettings(): Promise<{
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
  updateSettings(
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
  ): Promise<{
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
  connectGoogle(): Promise<boolean>;
  disconnectGoogle(): Promise<void>;
  listActiveWindows(): Promise<{ app: string; title: string }[]>;
  setIgnoreMouseEvents(ignore: boolean): Promise<void>;
  setTrackingState(tracking: boolean): Promise<void>;

  getScreenRecordingStatus(): Promise<
    'granted' | 'denied' | 'not-determined' | 'restricted' | 'unsupported'
  >;
  requestScreenRecording(): Promise<'granted' | 'denied' | 'unsupported'>;
  openScreenRecordingSettings(): Promise<void>;
  on(channel: string, callback: (...args: unknown[]) => void): () => void;
  signup: {
    start: () => Promise<void>;
    complete: () => Promise<void>;
  };
  auth: {
    signIn: () => Promise<{ signedIn: boolean; email: string | null }>;
    signOut: () => Promise<{ signedIn: boolean; email: string | null }>;
    getStatus: () => Promise<{ signedIn: boolean; email: string | null }>;
  };
  platform: string;
  minimizeWindow(): Promise<void>;
  maximizeWindow(): Promise<void>;
  closeWindow(): Promise<void>;
}

declare global {
  interface Window {
    api: PloverAPI;
  }
}
