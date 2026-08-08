import Database from 'better-sqlite3';
import { Task } from '../../../shared/types.js';
import { TasksRepo } from '../../store/repos/tasks.js';
import { ActivityRepo, ActivityRow } from '../../store/repos/activity.js';
import { SummariesRepo } from '../../store/repos/summaries.js';
import { SettingsRepo } from '../../store/repos/settings.js';
import { schedulePeriodic } from '../../lifecycle/periodic.js';
import { TypedEventBus } from '../../events/bus.js';
import { authedFetch, UnauthorizedError } from '../../http/authed-fetch.js';
import {
  BASELINE_INFERENCE_INTERVAL_MS,
  FAST_INFERENCE_INTERVAL_MS,
  TASK_YOUNG_WINDOW_MS,
  EPOCH_TS,
  SCREENSHOT_ACTIVITY_KINDS,
  type TaskProgressEntry,
  type InferProgressResponse,
} from './types.js';

export class InferenceEngine {
  private dispose: (() => void) | null = null;
  private now: () => Date;
  private currentIntervalMs: number = BASELINE_INFERENCE_INTERVAL_MS;
  private firstSeenInProgressAt = new Map<string, number>();

  constructor(
    private tasksRepo: TasksRepo,
    private activityRepo: ActivityRepo,
    private summariesRepo: SummariesRepo,
    private settingsRepo: SettingsRepo,
    private bus: TypedEventBus,
    private db: Database.Database,
    now?: () => Date,
  ) {
    this.now = now ?? (() => new Date());
  }

  get pollIntervalMs(): number {
    return this.currentIntervalMs;
  }

  start(): void {
    this.dispose = schedulePeriodic(
      'inference',
      () => this.currentIntervalMs,
      () => this.runInferencePass(),
    );
  }

  stop(): void {
    if (this.dispose) {
      this.dispose();
      this.dispose = null;
    }
  }

  // Returns true while any task is within its "just started" window. Also
  // updates the in-memory first-seen tracking: records the moment a task first
  // shows up as 'in_progress', and forgets tasks that have left that status.
  private updatePacing(allTasks: Task[], nowMs: number): boolean {
    const inProgressIds = new Set(
      allTasks.filter((t) => t.status === 'in_progress').map((t) => t.id),
    );
    for (const id of inProgressIds) {
      if (!this.firstSeenInProgressAt.has(id)) {
        this.firstSeenInProgressAt.set(id, nowMs);
      }
    }
    for (const id of [...this.firstSeenInProgressAt.keys()]) {
      if (!inProgressIds.has(id)) {
        this.firstSeenInProgressAt.delete(id);
      }
    }
    for (const startedAtMs of this.firstSeenInProgressAt.values()) {
      if (nowMs - startedAtMs < TASK_YOUNG_WINDOW_MS) return true;
    }
    return false;
  }

  async runInferencePass(): Promise<void> {
    const lastTs = this.settingsRepo.getAll().lastInferenceTs ?? EPOCH_TS;
    const now = this.now();
    const nowTs = now.toISOString();
    const { activeTasks, activity } = this.collectInputs(lastTs, now.getTime());

    if (activeTasks.length === 0 || activity.length === 0) {
      this.settingsRepo.update({ lastInferenceTs: nowTs });
      return;
    }

    const payload = await this.fetchInference(activeTasks, activity);
    if (payload === null) return;

    this.applyProgress(payload, activeTasks, nowTs);
    this.settingsRepo.update({ lastInferenceTs: nowTs });
  }

  private collectInputs(
    lastTs: string,
    nowMs: number,
  ): { activeTasks: Task[]; activity: ActivityRow[] } {
    const allTasks = this.tasksRepo.list();
    const activeTasks = allTasks.filter((t) => t.status === 'todo' || t.status === 'scheduled');

    const isFastTick = this.updatePacing(allTasks, nowMs);
    this.currentIntervalMs = isFastTick
      ? FAST_INFERENCE_INTERVAL_MS
      : BASELINE_INFERENCE_INTERVAL_MS;

    const rawActivity = this.activityRepo.listSince(lastTs);
    // Fast ticks stay text-only (no screenshot/vision-derived signal) so they
    // never depend on the vision pipeline's cost or gating — the normal
    // baseline-cadence passes still see everything, screenshots included.
    const activity = isFastTick
      ? rawActivity.filter((a) => !SCREENSHOT_ACTIVITY_KINDS.has(a.kind))
      : rawActivity;

    return { activeTasks, activity };
  }

  private async fetchInference(
    activeTasks: Task[],
    activity: ActivityRow[],
  ): Promise<TaskProgressEntry[] | null> {
    let response: Response;
    try {
      response = await authedFetch('/api/infer-progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(15000),
        body: JSON.stringify({
          tasks: activeTasks.map((t) => ({ id: t.id, title: t.title, status: t.status })),
          activity: activity.map((a) => ({ kind: a.kind, payload: a.payload, ts: a.ts })),
        }),
      });
    } catch (err) {
      if (err instanceof UnauthorizedError) throw err;
      console.error('[InferenceEngine] Network error:', err);
      return null;
    }

    if (!response.ok) {
      console.error('[InferenceEngine] Server responded with status', response.status);
      return null;
    }

    let parsed: InferProgressResponse;
    try {
      parsed = (await response.json()) as InferProgressResponse;
    } catch (err) {
      console.error('[InferenceEngine] Failed to parse response JSON:', err);
      return null;
    }

    if (!parsed.task_progress || !Array.isArray(parsed.task_progress)) {
      console.error('[InferenceEngine] Invalid response payload');
      return null;
    }
    return parsed.task_progress;
  }

  private applyProgress(entries: TaskProgressEntry[], activeTasks: Task[], nowTs: string): void {
    const validIds = new Set(activeTasks.map((t) => t.id));
    for (const entry of entries) {
      if (!validIds.has(entry.taskId)) continue;

      try {
        const { done, inserted } = this.db.transaction(() => {
          const increment = entry.progress_increment ?? 0;
          const updated = this.tasksRepo.incrementProgress(entry.taskId, increment);
          const previousStatus = updated.status;

          const shouldComplete = entry.completed || updated.progress >= 100;
          const done =
            shouldComplete && updated.status !== 'done'
              ? this.tasksRepo.update(entry.taskId, { status: 'done' })
              : null;

          const inserted = this.summariesRepo.insert({
            taskId: entry.taskId,
            summary: entry.reasoning,
            signal: Math.min(1, Math.max(0, increment / 100)),
            source: 'inference',
            progressDelta: increment,
            previousStatus,
            ts: nowTs,
          });

          return { done, inserted };
        })();

        if (done) this.bus.emit('task.completed', done);
        this.bus.emit('summary.created', inserted);
      } catch (err) {
        console.error('[InferenceEngine] Failed to apply progress for task', entry.taskId, err);
      }
    }
  }
}
