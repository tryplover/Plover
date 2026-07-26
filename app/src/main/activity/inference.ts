import { Task } from '../../shared/types.js';
import { TasksRepo } from '../store/repos/tasks.js';
import { ActivityRepo, ActivityRow } from '../store/repos/activity.js';
import { SummariesRepo } from '../store/repos/summaries.js';
import { SettingsRepo } from '../store/repos/settings.js';
import { schedulePeriodic } from '../lifecycle/periodic.js';
import { TypedEventBus } from '../events/bus.js';
import { authedFetch, UnauthorizedError } from '../http/authed-fetch.js';

const INFERENCE_INTERVAL_MS = 30 * 60_000;
const EPOCH_TS = '1970-01-01T00:00:00.000Z';

export interface TaskProgressEntry {
  taskId: string;
  progress_increment: number;
  completed: boolean;
  reasoning: string;
}

interface InferProgressResponse {
  task_progress?: TaskProgressEntry[];
  error?: string;
}

export class InferenceEngine {
  private dispose: (() => void) | null = null;

  constructor(
    private tasksRepo: TasksRepo,
    private activityRepo: ActivityRepo,
    private summariesRepo: SummariesRepo,
    private settingsRepo: SettingsRepo,
    private bus: TypedEventBus,
  ) {}

  start(): void {
    this.dispose = schedulePeriodic('inference', INFERENCE_INTERVAL_MS, () =>
      this.runInferencePass(),
    );
  }

  stop(): void {
    if (this.dispose) {
      this.dispose();
      this.dispose = null;
    }
  }

  async runInferencePass(): Promise<void> {
    const lastTs = this.settingsRepo.getAll().lastInferenceTs ?? EPOCH_TS;
    const nowTs = new Date().toISOString();
    const { activeTasks, activity } = this.collectInputs(lastTs);

    if (activeTasks.length === 0 || activity.length === 0) {
      this.settingsRepo.update({ lastInferenceTs: nowTs });
      return;
    }

    const payload = await this.fetchInference(activeTasks, activity);
    if (payload === null) return;

    this.applyProgress(payload, activeTasks, nowTs);
    this.settingsRepo.update({ lastInferenceTs: nowTs });
  }

  private collectInputs(lastTs: string): { activeTasks: Task[]; activity: ActivityRow[] } {
    const allTasks = this.tasksRepo.list();
    const activeTasks = allTasks.filter((t) => t.status === 'todo' || t.status === 'scheduled');
    const activity = this.activityRepo.listSince(lastTs);
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

      const increment = entry.progress_increment ?? 0;
      const updated = this.tasksRepo.incrementProgress(entry.taskId, increment);
      const previousStatus = updated.status;

      const shouldComplete = entry.completed || updated.progress >= 100;
      if (shouldComplete && updated.status !== 'done') {
        const done = this.tasksRepo.update(entry.taskId, { status: 'done' });
        this.bus.emit('task.completed', done);
      }

      const inserted = this.summariesRepo.insert({
        taskId: entry.taskId,
        summary: entry.reasoning,
        signal: Math.min(1, Math.max(0, increment / 100)),
        source: 'inference',
        progressDelta: increment,
        previousStatus,
        ts: nowTs,
      });
      this.bus.emit('summary.created', inserted);
    }
  }
}
