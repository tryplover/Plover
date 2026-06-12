import * as chokidar from 'chokidar';
import { SettingsRepo } from '../store/repos/settings.js';
import { ActivityRepo } from '../store/repos/activity.js';

export class FolderWatcher {
  private watcher: chokidar.FSWatcher | null = null;
  private settingsRepo: SettingsRepo;
  private activityRepo: ActivityRepo;

  constructor(settingsRepo: SettingsRepo, activityRepo: ActivityRepo) {
    this.settingsRepo = settingsRepo;
    this.activityRepo = activityRepo;
    const initialFolders = this.settingsRepo.getAll().watchedFolders ?? [];
    this.updateWatchedFolders(initialFolders);
  }

  updateWatchedFolders(paths: string[]): void {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }

    if (paths.length === 0) {
      return;
    }

    this.watcher = chokidar.watch(paths, {
      alwaysStat: true,
      ignoreInitial: true,
    });

    this.watcher.on('all', (event, filePath, stats) => {
      if (event === 'add' || event === 'change' || event === 'unlink') {
        const mtime = stats?.mtime ? stats.mtime.toISOString() : new Date().toISOString();
        this.activityRepo.log('file_modified', {
          path: filePath,
          event,
          mtime,
        });
      }
    });
  }

  async close(): Promise<void> {
    if (this.watcher) {
      await this.watcher.close();
      this.watcher = null;
    }
  }
}
