import { watch, FSWatcher } from 'chokidar';
import { ActivityRepo } from '../../store/repos/activity.js';
import { SettingsRepo } from '../../store/repos/settings.js';
import { TypedEventBus } from '../../events/bus.js';
import { FolderEventPayload } from '@shared/events.js';
import { gate } from '../shared/gate.js';
import { serializeAsync } from '../shared/serialize-async.js';

export class FolderWatcher {
  private watcher: FSWatcher | null = null;
  private watchedPaths = new Set<string>();
  private enqueue = serializeAsync((err) => {
    console.error('[FolderWatcher]', err);
  });

  constructor(
    private activityRepo: ActivityRepo,
    private settingsRepo: SettingsRepo,
    private bus: TypedEventBus,
  ) {}

  watch(paths: string[]): Promise<void> {
    return this.enqueue(() => this.internalWatch(paths));
  }

  unwatch(paths: string[]): Promise<void> {
    return this.enqueue(() => this.internalUnwatch(paths));
  }

  closeAllWatchers(): Promise<void> {
    return this.enqueue(() => this.internalClose());
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
      ignored: shouldIgnoreForFolderWatch,
      persistent: true,
    });

    this.watcher.on('change', (p: string) => {
      this.handleFileEvent('file_modified', 'folder.file_changed', p);
    });

    this.watcher.on('add', (p: string) => {
      this.handleFileEvent('file_added', 'folder.file_added', p);
    });

    this.watcher.on('error', (err: unknown) => {
      console.error('[FolderWatcher] chokidar watcher error:', err);
    });
  }

  private async internalUnwatch(paths: string[]): Promise<void> {
    for (const p of paths) {
      this.watchedPaths.delete(p);
    }

    if (this.watchedPaths.size === 0) {
      if (this.watcher) {
        await this.watcher.close();
        this.watcher = null;
      }
      return;
    }

    await this.internalWatch(Array.from(this.watchedPaths));
  }

  private async internalClose(): Promise<void> {
    if (this.watcher) {
      await this.watcher.close();
      this.watcher = null;
    }
    this.watchedPaths.clear();
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

  private handleFileEvent(
    kind: 'file_added' | 'file_modified',
    busChannel: 'folder.file_added' | 'folder.file_changed',
    path: string,
  ): void {
    if (!gate(this.settingsRepo, 'fileWatchingEnabled')) return;

    const fileKind = this.determineKind(path);
    const payload: FolderEventPayload = { path, kind: fileKind };

    this.activityRepo.insert({ kind, payload: { path, kind: fileKind } });
    this.bus.emit(busChannel, payload);
  }
}

function shouldIgnoreForFolderWatch(testPath: string): boolean {
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
}
