import { TasksRepo } from '../store/repos/tasks.js';
import { ActivityRepo } from '../store/repos/activity.js';
import { SummariesRepo } from '../store/repos/summaries.js';
import { SettingsRepo } from '../store/repos/settings.js';
import { schedulePeriodic } from '../lifecycle/periodic.js';
import { TypedEventBus } from '../bus.js';

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
    const settings = this.settingsRepo.getAll();
    const lastTs = settings.lastInferenceTs ?? EPOCH_TS;
    const nowTs = new Date().toISOString();

    const allTasks = this.tasksRepo.list();
    const activeTasks = allTasks.filter((t) => t.status === 'todo' || t.status === 'scheduled');
    const activity = this.activityRepo.listSince(lastTs);

    if (activeTasks.length === 0 || activity.length === 0) {
      this.settingsRepo.update({ lastInferenceTs: nowTs });
      return;
    }

    const backendUrl = (process.env.PLOVER_BACKEND_URL || 'http://localhost:3000').trim();
    const authToken = process.env.PLOVER_AUTH_TOKEN;
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (authToken) {
      headers['X-Plover-Auth-Token'] = authToken;
    }

    let response: Response;
    try {
      response = await fetch(`${backendUrl}/api/infer-progress`, {
        method: 'POST',
        headers,
        signal: AbortSignal.timeout(15000),
        body: JSON.stringify({
          tasks: activeTasks.map((t) => ({ id: t.id, title: t.title, status: t.status })),
          activity: activity.map((a) => ({ kind: a.kind, payload: a.payload, ts: a.ts })),
        }),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.bus.emit('inference.error', { message: 'Network error: ' + message });
      return;
    }

    if (!response.ok) {
      const message = 'Server responded with status ' + response.status;
      this.bus.emit('inference.error', { message });
      return;
    }

    let payload: InferProgressResponse;
    try {
      payload = (await response.json()) as InferProgressResponse;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.bus.emit('inference.error', { message: 'Failed to parse response: ' + message });
      return;
    }

    if (!payload || !payload.task_progress || !Array.isArray(payload.task_progress)) {
      const message = 'Invalid response payload: missing task_progress';
      this.bus.emit('inference.error', { message });
      return;
    }

    const validIds = new Set(activeTasks.map((t) => t.id));
    for (const entry of payload.task_progress) {
      if (!validIds.has(entry.taskId)) continue;
      if (entry.completed) {
        const updated = this.tasksRepo.update(entry.taskId, { status: 'done' });
        this.bus.emit('task.completed', updated);
      }
      const inserted = this.summariesRepo.insert({
        taskId: entry.taskId,
        summary: entry.reasoning,
        signal: Math.min(1, Math.max(0, (entry.progress_increment ?? 0) / 100)),
        ts: nowTs,
      });
      this.bus.emit('summary.created', inserted);
    }

    this.settingsRepo.update({ lastInferenceTs: nowTs });
  }
}
