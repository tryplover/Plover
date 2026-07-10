import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { Notification } from 'electron';
import { TasksRepo } from '../store/repos/tasks.js';
import { ActivityRepo } from '../store/repos/activity.js';
import { TypedEventBus } from '../bus.js';
import { FolderEventPayload } from '@shared/events.js';
import { authedFetch } from '../http/authed-fetch.js';

const execFileAsync = promisify(execFile);

export interface GitCommitInfo {
  repoPath: string;
  hash: string;
  message: string;
}

export interface MatchCommitResponse {
  matchedTaskId: string | null;
  reasoning?: string;
}

export type CommitMatcher = (
  commit: GitCommitInfo,
  tasks: { id: string; title: string }[],
) => Promise<MatchCommitResponse>;

export class GitCommitTracker {
  private onFileChangedHandler: ((payload: FolderEventPayload) => void) | null = null;
  private onFileAddedHandler: ((payload: FolderEventPayload) => void) | null = null;
  private seenHashes = new Set<string>();
  private seenHashesList: string[] = [];
  private inflight: Promise<void> = Promise.resolve();

  constructor(
    private tasksRepo: TasksRepo,
    private activityRepo: ActivityRepo,
    private bus: TypedEventBus,
    private matchCommit: CommitMatcher = defaultMatchCommit,
    private notify: (title: string, body: string) => void = defaultNotify,
  ) {}

  start(): void {
    this.onFileChangedHandler = (payload) => this.enqueue(payload);
    this.onFileAddedHandler = (payload) => this.enqueue(payload);
    this.bus.on('folder.file_changed', this.onFileChangedHandler);
    this.bus.on('folder.file_added', this.onFileAddedHandler);
  }

  stop(): void {
    if (this.onFileChangedHandler) {
      this.bus.off('folder.file_changed', this.onFileChangedHandler);
      this.onFileChangedHandler = null;
    }
    if (this.onFileAddedHandler) {
      this.bus.off('folder.file_added', this.onFileAddedHandler);
      this.onFileAddedHandler = null;
    }
  }

  private enqueue(payload: FolderEventPayload): void {
    if (payload.kind !== 'git_commit_editmsg') return;
    this.inflight = this.inflight.then(() => this.handleCommitEvent(payload.path));
  }

  private async handleCommitEvent(filePath: string): Promise<void> {
    try {
      const repoPath = extractRepoPath(filePath);
      if (!repoPath) return;

      const commit = await this.readLatestCommit(repoPath);
      if (!commit) return;
      if (this.seenHashes.has(commit.hash)) return;
      this.seenHashes.add(commit.hash);
      this.seenHashesList.push(commit.hash);
      if (this.seenHashesList.length > 5000) {
        const oldest = this.seenHashesList.shift();
        if (oldest !== undefined) {
          this.seenHashes.delete(oldest);
        }
      }

      this.activityRepo.insert({
        kind: 'git_commit',
        payload: { repoPath: commit.repoPath, hash: commit.hash, message: commit.message },
      });

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
    } catch (err) {
      console.error('[GitCommitTracker] Error handling commit event:', filePath, err);
    }
  }

  private async readLatestCommit(repoPath: string): Promise<GitCommitInfo | null> {
    if (repoPath.startsWith('-')) {
      return null;
    }
    try {
      const { stdout } = await execFileAsync(
        'git',
        ['-C', repoPath, 'log', '-1', '--pretty=format:%H%n%B'],
        { maxBuffer: 1024 * 1024 },
      );
      const trimmed = stdout.replace(/\n+$/, '');
      const newlineIdx = trimmed.indexOf('\n');
      if (newlineIdx === -1) {
        return { repoPath, hash: trimmed, message: '' };
      }
      const hash = trimmed.slice(0, newlineIdx);
      const message = trimmed.slice(newlineIdx + 1);
      if (!hash) return null;
      return { repoPath, hash, message };
    } catch (err) {
      console.error('[GitCommitTracker] git log failed in', repoPath, err);
      return null;
    }
  }
}

export function extractRepoPath(commitEditMsgPath: string): string | null {
  const normalized = commitEditMsgPath.replace(/\\/g, '/');
  const marker = '/.git/COMMIT_EDITMSG';
  if (!normalized.endsWith(marker)) return null;
  return normalized.slice(0, normalized.length - marker.length);
}

async function defaultMatchCommit(
  commit: GitCommitInfo,
  tasks: { id: string; title: string }[],
): Promise<MatchCommitResponse> {
  const response = await authedFetch('/api/match-commit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      commit,
      tasks,
    }),
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
    console.error('[GitCommitTracker] Notification failed:', err);
  }
}
