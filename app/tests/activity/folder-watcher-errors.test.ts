import { describe, expect, it, beforeEach, vi } from 'vitest';
import { FolderWatcher } from '@main/activity/folder-watcher.js';
import { ActivityRepo } from '@main/store/repos/activity.js';
import { SettingsRepo } from '@main/store/repos/settings.js';
import { TypedEventBus } from '@main/bus.js';
import Database from 'better-sqlite3';
import { runMigrations } from '@main/store/db.js';
import * as chokidar from 'chokidar';

vi.mock('chokidar', () => {
  return {
    watch: vi.fn(),
  };
});

describe('FolderWatcher Error Handling', () => {
  let db: Database.Database;
  let activityRepo: ActivityRepo;
  let settingsRepo: SettingsRepo;
  let eventBus: TypedEventBus;
  let folderWatcher: FolderWatcher;

  beforeEach(() => {
    db = new Database(':memory:');
    runMigrations(db);
    activityRepo = new ActivityRepo(db);
    settingsRepo = new SettingsRepo(db);
    eventBus = new TypedEventBus();
    // Pass a dummy notify function to avoid Electron Notification errors in tests
    folderWatcher = new FolderWatcher(activityRepo, settingsRepo, eventBus, vi.fn());
    vi.clearAllMocks();
  });

  it('propagates errors in watch()', async () => {
    const error = new Error('Chokidar failed');
    vi.mocked(chokidar.watch).mockImplementation(() => {
      throw error;
    });

    await expect(folderWatcher.watch(['/test/path'])).rejects.toThrow('Chokidar failed');
  });

  it('notifies on watch() error', async () => {
    const notifySpy = vi.fn();
    folderWatcher = new FolderWatcher(activityRepo, settingsRepo, eventBus, notifySpy);

    const error = new Error('Chokidar failed');
    vi.mocked(chokidar.watch).mockImplementation(() => {
      throw error;
    });

    try {
      await folderWatcher.watch(['/test/path']);
    } catch {
      // ignore
    }

    expect(notifySpy).toHaveBeenCalledWith(
      'Folder Watcher Error',
      expect.stringContaining('Chokidar failed'),
    );
  });

  it('recovers watchChain after failure', async () => {
    const error = new Error('Chokidar failed');
    vi.mocked(chokidar.watch).mockImplementationOnce(() => {
      throw error;
    });

    // First call fails
    await expect(folderWatcher.watch(['/fail'])).rejects.toThrow('Chokidar failed');

    // Second call should still work (it waits for the previous chain to recover)
    vi.mocked(chokidar.watch).mockImplementationOnce(() => {
      return {
        on: vi.fn(),
        close: vi.fn().mockResolvedValue(undefined),
      } as unknown as chokidar.FSWatcher;
    });

    await expect(folderWatcher.watch(['/success'])).resolves.toBeUndefined();
    expect(chokidar.watch).toHaveBeenCalledTimes(2);
  });
});
