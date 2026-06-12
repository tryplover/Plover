import { describe, expect, it, afterEach, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runMigrations } from '@main/store/db.js';
import { SettingsRepo } from '@main/store/repos/settings.js';
import { ActivityRepo, ActivityRow } from '@main/store/repos/activity.js';
import { FolderWatcher } from '@main/activity/folder-watcher.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('ActivityRepo', () => {
  it('should log activity and list it correctly', () => {
    const db = new Database(':memory:');
    runMigrations(db);
    const repo = new ActivityRepo(db);

    repo.log('test_event', { foo: 'bar' });

    const logs = repo.list();
    expect(logs).toHaveLength(1);
    const firstLog = logs[0];
    expect(firstLog?.kind).toBe('test_event');
    expect(firstLog?.payload).toEqual({ foo: 'bar' });
    expect(new Date(firstLog?.ts ?? '').getTime()).not.toBeNaN();
  });
});

describe('FolderWatcher', () => {
  let tempDir: string;
  let db: Database.Database;
  let settingsRepo: SettingsRepo;
  let activityRepo: ActivityRepo;
  let watcher: FolderWatcher;

  beforeEach(() => {
    tempDir = path.join(__dirname, 'temp-watch-' + Math.random().toString(36).substring(2, 9));
    fs.mkdirSync(tempDir, { recursive: true });

    db = new Database(':memory:');
    runMigrations(db);
    settingsRepo = new SettingsRepo(db);
    activityRepo = new ActivityRepo(db);
  });

  afterEach(async () => {
    if (watcher) {
      await watcher.close();
    }
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('should detect add, change, and unlink events', async () => {
    watcher = new FolderWatcher(settingsRepo, activityRepo);
    await watcher.updateWatchedFolders([tempDir]);

    // Give chokidar some time to initialize
    await new Promise((resolve) => setTimeout(resolve, 300));

    // 1. Add file
    const testFile = path.join(tempDir, 'test.txt');
    fs.writeFileSync(testFile, 'hello');

    // Wait for the 'add' log
    let logs = await waitForLogs(activityRepo, 1);
    expect(logs).toHaveLength(1);
    const addPayload = logs[0]?.payload as { event: string; path: string; mtime: string };
    expect(addPayload?.event).toBe('add');
    expect(addPayload?.path).toBe(testFile);
    expect(new Date(addPayload?.mtime ?? '').getTime()).not.toBeNaN();

    // 2. Change file
    fs.writeFileSync(testFile, 'hello world');

    // Wait for the 'change' log
    logs = await waitForLogs(activityRepo, 2);
    expect(logs).toHaveLength(2);
    const changePayload = logs[1]?.payload as { event: string; path: string };
    expect(changePayload?.event).toBe('change');
    expect(changePayload?.path).toBe(testFile);

    // 3. Unlink (delete) file
    fs.unlinkSync(testFile);

    // Wait for the 'unlink' log
    logs = await waitForLogs(activityRepo, 3);
    expect(logs).toHaveLength(3);
    const unlinkPayload = logs[2]?.payload as { event: string; path: string };
    expect(unlinkPayload?.event).toBe('unlink');
    expect(unlinkPayload?.path).toBe(testFile);
  });
});

async function waitForLogs(
  repo: ActivityRepo,
  count: number,
  timeout = 2500,
): Promise<ActivityRow[]> {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const logs = repo.list('file_modified');
    if (logs.length >= count) {
      return logs;
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  return repo.list('file_modified');
}
