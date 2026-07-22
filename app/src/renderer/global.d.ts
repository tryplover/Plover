import { Goal, Task } from '../shared/types';

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

export interface PloverAPI {
  proposeGoal(goalText: string): Promise<ProposedPlan>;
  commitGoal(plan: ProposedPlan): Promise<{ goalId: string }>;
  getGoals(): Promise<Goal[]>;
  getTasks(): Promise<Task[]>;
  updateTaskStatus(id: string, status: Task['status']): Promise<Task>;
  getSettings(): Promise<{
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
  updateSettings(
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
  ): Promise<{
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
  connectGoogle(): Promise<boolean>;
  disconnectGoogle(): Promise<void>;

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
  companion: {
    show(): Promise<void>;
    hide(): Promise<void>;
    setActiveTask(taskId: string | null): Promise<void>;
    setState(kind: string): Promise<void>;
    resize(height: number, width?: number): Promise<void>;
    getInitialState(): Promise<{ kind: string; activeTaskId: string | null }>;
  };
  platform: string;
}

interface ImportMetaEnv {
  readonly PLOVER_VERSION: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare global {
  interface Window {
    api: PloverAPI;
  }
}
