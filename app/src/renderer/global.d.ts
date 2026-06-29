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
      | 'calendar_event_id'
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
    calendarEvents: { id: string; summary: string; start: string; end: string }[],
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
      | 'calendar_event_id'
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
  connectCalendar(): Promise<boolean>;
  disconnectCalendar(): Promise<void>;
  listActiveWindows(): Promise<{ app: string; title: string }[]>;
  setIgnoreMouseEvents(ignore: boolean): Promise<void>;
  setTrackingState(tracking: boolean): Promise<void>;
  listActivity(args?: { since?: string; until?: string; kinds?: string[]; limit?: number; offset?: number }): Promise<{ id: number; ts: string; kind: string; payload: Record<string, unknown> }[]>;
  getActivityById(id: number): Promise<{ id: number; ts: string; kind: string; payload: Record<string, unknown> } | null>;
  purgeActivity(args: { olderThan?: string; ids?: number[] }): Promise<{ deleted: number }>;
  getScreenshot(id: number): Promise<{ dataUrl: string } | null>;
  getScreenRecordingStatus(): Promise<'granted' | 'denied' | 'not-determined' | 'restricted' | 'unsupported'>;
  requestScreenRecording(): Promise<'granted' | 'denied' | 'unsupported'>;
  on(channel: string, callback: (...args: unknown[]) => void): () => void;
}

declare global {
  interface Window {
    api: PloverAPI;
  }
}
