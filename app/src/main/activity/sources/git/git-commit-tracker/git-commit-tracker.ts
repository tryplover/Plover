import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { ActivityRepo } from '../../../../store/repos/activity.js';
import { TypedEventBus } from '../../../../events/bus.js';
import { FolderEventPayload, GitCommitInfo } from '@shared/events.js';
import { serializeAsync } from '../../../shared/serialize-async.js';

const execFileAsync = promisify(execFile);

export class GitCommitTracker {
  private seenHashes = new Set<string>();
  private seenHashesList: string[] = [];
  private enqueue = serializeAsync((err) => {
    console.error('[GitCommitTracker]', err);
  });

  constructor(
    private activityRepo: ActivityRepo,
    private bus: TypedEventBus,
  ) {}

  start(): void {
    this.bus.on('folder.file_changed', this.onFileEvent);
    this.bus.on('folder.file_added', this.onFileEvent);
  }

  stop(): void {
    this.bus.off('folder.file_changed', this.onFileEvent);
    this.bus.off('folder.file_added', this.onFileEvent);
  }

  private onFileEvent = (payload: FolderEventPayload): void => {
    if (payload.kind !== 'git_commit_editmsg') return;
    void this.enqueue(() => this.handleCommitEvent(payload.path));
  };

  private async handleCommitEvent(filePath: string): Promise<void> {
    const commit = await this.resolveCommit(filePath);
    if (!commit) return;
    if (!this.markSeen(commit.hash)) return;
    this.recordCommit(commit);
  }

  private async resolveCommit(filePath: string): Promise<GitCommitInfo | null> {
    const repoPath = extractRepoPath(filePath);
    if (!repoPath) return null;
    return this.readLatestCommit(repoPath);
  }

  private markSeen(hash: string): boolean {
    if (this.seenHashes.has(hash)) return false;
    this.seenHashes.add(hash);
    this.seenHashesList.push(hash);
    if (this.seenHashesList.length > 5000) {
      const oldest = this.seenHashesList.shift();
      if (oldest !== undefined) {
        this.seenHashes.delete(oldest);
      }
    }
    return true;
  }

  private recordCommit(commit: GitCommitInfo): void {
    this.activityRepo.insert({
      kind: 'git_commit',
      payload: { repoPath: commit.repoPath, hash: commit.hash, message: commit.message },
    });
    this.bus.emit('activity.git_commit', commit);
  }

  private async readLatestCommit(repoPath: string): Promise<GitCommitInfo | null> {
    if (repoPath.startsWith('-')) return null;
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
