import chokidar from 'chokidar';
import { ActivityRepo } from '../store/repos/activity.js';
import { TypedEventBus } from '../bus.js';
import { FolderEventPayload } from '@shared/events.js';

export class FolderWatcher {
  private watcher: chokidar.FSWatcher | null = null;
  private watchedPaths = new Set<string>();
  private watchChain: Promise<void> = Promise.resolve();

  constructor(
    private activityRepo: ActivityRepo,
    private bus: TypedEventBus,
  ) {}

  watch(paths: string[]): Promise<void> {
    this.watchChain = this.watchChain
      .then(() => this.internalWatch(paths))
      .catch((err) => {
        console.error('[FolderWatcher] Error in watch:', err);
      });
    return this.watchChain;
  }

  unwatch(paths: string[]): Promise<void> {
    this.watchChain = this.watchChain
      .then(async () => {
        for (const path of paths) {
          this.watchedPaths.delete(path);
        }

        if (this.watchedPaths.size === 0) {
          if (this.watcher) {
            await this.watcher.close();
            this.watcher = null;
          }
        } else {
          await this.internalWatch(Array.from(this.watchedPaths));
        }
      })
      .catch((err) => {
        console.error('[FolderWatcher] Error in unwatch:', err);
      });
    return this.watchChain;
  }

  closeAllWatchers(): Promise<void> {
    this.watchChain = this.watchChain
      .then(async () => {
        if (this.watcher) {
          await this.watcher.close();
          this.watcher = null;
        }
        this.watchedPaths.clear();
      })
      .catch((err) => {
        console.error('[FolderWatcher] Error in closeAllWatchers:', err);
      });
    return this.watchChain;
  }

  private async internalWatch(paths: string[]): Promise<void> {
    if (this.watcher) {
      await this.watcher.close();
    }

    this.watchedPaths = new Set(paths);

    if (paths.length === 0) {
      this.watcher = null;
      return;
    }

    this.watcher = chokidar.watch(paths, {
      awaitWriteFinish: false,
      ignored: (testPath: string) => {
        const normalized = testPath.replace(/\\/g, '/');
        if (normalized.includes('node_modules')) {
          return true;
        }
        const parts = normalized.split('/');
        const gitIndex = parts.indexOf('.git');
        if (gitIndex !== -1) {
          const subPath = parts.slice(gitIndex).join('/');
          return subPath !== '.git' && subPath !== '.git/COMMIT_EDITMSG';
        }
        const basename = parts[parts.length - 1] ?? '';
        return basename.startsWith('.') && basename !== '.git';
      },
      persistent: true,
    });

    this.watcher.on('change', (path) => {
      this.handleFileChange(path);
    });

    this.watcher.on('add', (path) => {
      this.handleFileAdd(path);
    });
  }

  private determineKind(filePath: string): 'md' | 'git_commit_editmsg' | 'other' {
    if (filePath.endsWith('.md')) {
      return 'md';
    }
    const normalized = filePath.replace(/\\/g, '/');
    if (normalized.endsWith('/COMMIT_EDITMSG') || normalized === 'COMMIT_EDITMSG') {
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
}
