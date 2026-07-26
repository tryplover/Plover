import { Notification } from 'electron';
import { TasksRepo } from '../store/repos/tasks.js';
import { TypedEventBus } from '../events/bus.js';
import { GitCommitInfo } from '@shared/events.js';
import { authedFetch } from '../http/authed-fetch.js';

export interface MatchCommitResponse {
  matchedTaskId: string | null;
  reasoning?: string;
}

export type CommitMatcher = (
  commit: GitCommitInfo,
  tasks: { id: string; title: string }[],
) => Promise<MatchCommitResponse>;

export class CommitTaskMatcher {
  constructor(
    private tasksRepo: TasksRepo,
    private bus: TypedEventBus,
    private matchCommit: CommitMatcher = defaultMatchCommit,
    private notify: (title: string, body: string) => void = defaultNotify,
  ) {}

  start(): void {
    this.bus.on('activity.git_commit', this.onCommitLogged);
  }

  stop(): void {
    this.bus.off('activity.git_commit', this.onCommitLogged);
  }

  private onCommitLogged = (commit: GitCommitInfo): void => {
    void this.handleCommit(commit).catch((err) => {
      console.error('[CommitTaskMatcher] Error handling commit:', err);
    });
  };

  private async handleCommit(commit: GitCommitInfo): Promise<void> {
    const allTasks = this.tasksRepo.list();
    const activeTasks = allTasks.filter((t) => t.status === 'todo' || t.status === 'scheduled');
    if (activeTasks.length === 0) return;

    const result = await this.matchCommit(
      commit,
      activeTasks.map((t) => ({ id: t.id, title: t.title })),
    );
    if (!result.matchedTaskId) return;

    const matched = activeTasks.find((t) => t.id === result.matchedTaskId);
    if (!matched) return;

    const updated = this.tasksRepo.update(matched.id, { status: 'done' });
    if (updated) {
      this.bus.emit('task.completed', updated);
    }
    this.notify('Plover', `Marked "${matched.title}" as done based on your git commit.`);
  }
}

async function defaultMatchCommit(
  commit: GitCommitInfo,
  tasks: { id: string; title: string }[],
): Promise<MatchCommitResponse> {
  const response = await authedFetch('/api/match-commit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ commit, tasks }),
  });
  if (!response.ok) {
    throw new Error(`match-commit responded with ${response.status}`);
  }
  return (await response.json()) as MatchCommitResponse;
}

export function defaultNotify(title: string, body: string): void {
  try {
    new Notification({ title, body }).show();
  } catch (err) {
    console.error('[CommitTaskMatcher] Notification failed:', err);
  }
}
