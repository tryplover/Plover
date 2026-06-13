import { TasksRepo } from '../store/repos/tasks.js';
import { ActivityRepo } from '../store/repos/activity.js';
import { SummariesRepo } from '../store/repos/summaries.js';
import { SettingsRepo } from '../store/repos/settings.js';
import { schedulePeriodic } from '../lifecycle/periodic.js';

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
    const activeTasks = allTasks.filter(
      (t) => t.status === 'todo' || t.status === 'scheduled',
    );
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
        body: JSON.stringify({
          tasks: activeTasks.map((t) => ({ id: t.id, title: t.title, status: t.status })),
          activity: activity.map((a) => ({ kind: a.kind, payload: a.payload, ts: a.ts })),
        }),
      });
    } catch (err) {
      console.error('[InferenceEngine] Network error:', err);
      return;
    }

    if (!response.ok) {
      console.error('[InferenceEngine] Server responded with status', response.status);
      return;
    }

    let payload: InferProgressResponse;
    try {
      payload = (await response.json()) as InferProgressResponse;
    } catch (err) {
      console.error('[InferenceEngine] Failed to parse response JSON:', err);
      return;
    }

    if (!payload.task_progress || !Array.isArray(payload.task_progress)) {
      console.error('[InferenceEngine] Invalid response payload');
      return;
    }

    const validIds = new Set(activeTasks.map((t) => t.id));
    for (const entry of payload.task_progress) {
      if (!validIds.has(entry.taskId)) continue;
      if (entry.completed) {
        this.tasksRepo.update(entry.taskId, { status: 'done' });
      }
      this.summariesRepo.insert({
        taskId: entry.taskId,
        summary: entry.reasoning,
        signal: Math.min(1, Math.max(0, entry.progress_increment / 100)),
        ts: nowTs,
      });
    }

    this.settingsRepo.update({ lastInferenceTs: nowTs });
  }
}
