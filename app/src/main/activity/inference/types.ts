export const BASELINE_INFERENCE_INTERVAL_MS = 30 * 60_000;
// Faster cadence used while a task is newly started, so users see progress signal
// soon after beginning work instead of waiting up to the baseline interval.
export const FAST_INFERENCE_INTERVAL_MS = 10 * 60_000;
// How long after a task first enters 'in_progress' it still counts as newly
// started. Tracked in-memory only (see firstSeenInProgressAt below) rather than
// a persisted "started_at" column — created_at is unusable here because Planner
// bulk-creates all of a goal's subtasks at once, so it reflects when the goal was
// planned, not when this specific task began; updated_at is unusable because
// incrementProgress() bumps it on every pass, which would keep a task "young"
// forever. The in-memory tracking resets on app restart, same tradeoff already
// accepted for ScreenCapturer's pacing state.
export const TASK_YOUNG_WINDOW_MS = 2 * 60 * 60_000;
export const EPOCH_TS = '1970-01-01T00:00:00.000Z';
export const SCREENSHOT_ACTIVITY_KINDS = new Set(['screenshot_captured', 'screenshot_inferred']);

export interface TaskProgressEntry {
  taskId: string;
  progress_increment: number;
  completed: boolean;
  reasoning: string;
}

export interface InferProgressResponse {
  task_progress?: TaskProgressEntry[];
  error?: string;
}
