import { watch, FSWatcher } from 'chokidar';
import { Notification } from 'electron';
import { ActivityRepo } from '../store/repos/activity.js';
import { SettingsRepo } from '../store/repos/settings.js';
import { TypedEventBus } from '../bus.js';
import { FolderEventPayload } from '@shared/events.js';

export type NotifyFn = (title: string, body: string) => void;

const getErrorMessage = (err: unknown): string => {
  return err instanceof Error ? err.message : String(err);
};

const defaultNotify: NotifyFn = (title, body) => {
  try {
    if (Notification.isSupported()) {
      new Notification({ title, body }).show();
    } else {
      console.warn('[FolderWatcher] Notifications are not supported on this platform.');
    }
  } catch (err) {
    console.error('[FolderWatcher] Notification failed:', err);
  }
};

export class FolderWatcher {
  private watcher: FSWatcher | null = null;
  private watchedPaths = new Set<string>();
  private watchChain: Promise<void> = Promise.resolve();

  constructor(
    private activityRepo: ActivityRepo,
    private settingsRepo: SettingsRepo,
    private bus: TypedEventBus,
    private notify: NotifyFn = defaultNotify,
  ) {}

  watch(paths: string[]): Promise<void> {
    const p = this.watchChain.then(() => this.internalWatch(paths));
    this.watchChain = p.catch((err) => {
      console.error('[FolderWatcher] Error in watch:', err);
      this.notify('Folder Watcher Error', `Failed to watch folders: ${getErrorMessage(err)}`);
    });
    return p;
  }

  unwatch(paths: string[]): Promise<void> {
    const p = this.watchChain.then(async () => {
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
    });
    this.watchChain = p.catch((err) => {
      console.error('[FolderWatcher] Error in unwatch:', err);
      this.notify('Folder Watcher Error', `Failed to unwatch folders: ${getErrorMessage(err)}`);
    });
    return p;
  }

  closeAllWatchers(): Promise<void> {
    const p = this.watchChain.then(async () => {
      if (this.watcher) {
        await this.watcher.close();
        this.watcher = null;
      }
      this.watchedPaths.clear();
    });
    this.watchChain = p.catch((err) => {
      console.error('[FolderWatcher] Error in closeAllWatchers:', err);
      this.notify('Folder Watcher Error', `Failed to close watchers: ${getErrorMessage(err)}`);
    });
    return p;
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

    this.watcher = watch(paths, {
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

    this.watcher.on('change', (path: string) => {
      this.handleFileChange(path);
    });

    this.watcher.on('add', (path: string) => {
      this.handleFileAdd(path);
    });

    this.watcher.on('error', (err: unknown) => {
      console.error('[FolderWatcher] chokidar watcher error:', err);
      this.notify('Folder Watcher Error', `Chokidar error: ${getErrorMessage(err)}`);
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
    const settings = this.settingsRepo.getAll();
    if (settings.pauseAllTracking || !settings.fileWatchingEnabled) {
      return;
    }

    const kind = this.determineKind(path);
    const payload: FolderEventPayload = { path, kind };

    this.activityRepo.insert({
      kind: 'file_modified',
      payload: { path, kind },
    });

    this.bus.emit('folder.file_changed', payload);
  }

  private handleFileAdd(path: string): void {
    const settings = this.settingsRepo.getAll();
    if (settings.pauseAllTracking || !settings.fileWatchingEnabled) {
      return;
    }

    const kind = this.determineKind(path);
    const payload: FolderEventPayload = { path, kind };

    this.activityRepo.insert({
      kind: 'file_added',
      payload: { path, kind },
    });

    this.bus.emit('folder.file_added', payload);
  }
}
