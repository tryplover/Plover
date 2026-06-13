import chokidar from 'chokidar';
import { ActivityRepo } from '../store/repos/activity.js';
import { TypedEventBus } from '../bus.js';
import { FolderEventPayload } from '@shared/events.js';

export class FolderWatcher {
  private watcher: chokidar.FSWatcher | null = null;
  private watchedPaths: Set<string> = new Set();

  constructor(
    private activityRepo: ActivityRepo,
    private bus: TypedEventBus,
  ) {}

  watch(paths: string[]): void {
    if (this.watcher) {
      this.watcher.close();
    }

    this.watchedPaths = new Set(paths);

    if (paths.length === 0) {
      this.watcher = null;
      return;
    }

    this.watcher = chokidar.watch(paths, {
      awaitWriteFinish: false,
      ignored: /(^|[/\\])\.|node_modules|\.git/,
      persistent: true,
    });

    this.watcher.on('change', (path) => {
      this.handleFileChange(path);
    });

    this.watcher.on('add', (path) => {
      this.handleFileAdd(path);
    });
  }

  unwatch(paths: string[]): void {
    for (const path of paths) {
      this.watchedPaths.delete(path);
    }

    if (this.watchedPaths.size === 0) {
      if (this.watcher) {
        this.watcher.close();
        this.watcher = null;
      }
    } else {
      const remainingPaths = Array.from(this.watchedPaths);
      this.watch(remainingPaths);
    }
  }

  private determineKind(path: string): 'md' | 'git_commit_editmsg' | 'other' {
    if (path.endsWith('.md')) {
      return 'md';
    }
    if (path.endsWith('.git/COMMIT_EDITMSG') || path.endsWith('COMMIT_EDITMSG')) {
      return 'git_commit_editmsg';
    }
    return 'other';
  }

  private handleFileChange(path: string): void {
    const kind = this.determineKind(path);
    const payload: FolderEventPayload = { path, kind };

    this.activityRepo.insert({
      kind: 'file_modified',
      payload: { path, kind },
    });

    this.bus.emit('folder.file_changed', payload);
  }

  private handleFileAdd(path: string): void {
    const kind = this.determineKind(path);
    const payload: FolderEventPayload = { path, kind };

    this.activityRepo.insert({
      kind: 'file_added',
      payload: { path, kind },
    });

    this.bus.emit('folder.file_added', payload);
  }

  closeAllWatchers(): void {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }
    this.watchedPaths.clear();
  }
}
