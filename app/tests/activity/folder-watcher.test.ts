import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { writeFileSync, mkdirSync } from 'node:fs';
import { FolderWatcher } from '@main/activity/folder-watcher.js';
import { ActivityRepo } from '@main/store/repos/activity.js';
import { SettingsRepo } from '@main/store/repos/settings.js';
import { TypedEventBus } from '@main/events/bus.js';
import Database from 'better-sqlite3';
import { runMigrations } from '@main/store/db.js';

describe('FolderWatcher', () => {
  let testDir: string;
  let db: Database.Database;
  let activityRepo: ActivityRepo;
  let settingsRepo: SettingsRepo;
  let eventBus: TypedEventBus;
  let folderWatcher: FolderWatcher;

  beforeEach(() => {
    testDir = join(tmpdir(), `test-folder-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });

    db = new Database(':memory:');
    runMigrations(db);
    activityRepo = new ActivityRepo(db);
    settingsRepo = new SettingsRepo(db);
    eventBus = new TypedEventBus();
    folderWatcher = new FolderWatcher(activityRepo, settingsRepo, eventBus);
  });

  afterEach(async () => {
    await folderWatcher.closeAllWatchers();
  });

  it('watches a folder and detects file changes', async () => {
    const fileChangedHandler = vi.fn();
    eventBus.on('folder.file_changed', fileChangedHandler);

    folderWatcher.watch([testDir]);

    const testFile = join(testDir, 'test.txt');
    writeFileSync(testFile, 'initial content');

    await new Promise((resolve) => setTimeout(resolve, 100));

    writeFileSync(testFile, 'updated content');

    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(fileChangedHandler).toHaveBeenCalled();
  });

  it('detects file additions', async () => {
    const fileAddedHandler = vi.fn();
    eventBus.on('folder.file_added', fileAddedHandler);

    folderWatcher.watch([testDir]);

    await new Promise((resolve) => setTimeout(resolve, 100));

    const testFile = join(testDir, 'new-file.txt');
    writeFileSync(testFile, 'new content');

    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(fileAddedHandler).toHaveBeenCalled();
    const calls = fileAddedHandler.mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    const [firstCall] = calls;
    const payload = firstCall?.[0] as { path: string; kind: string };
    expect(payload.path).toContain('new-file.txt');
    expect(payload.kind).toBe('other');
  });

  it('correctly identifies markdown files', async () => {
    const fileAddedHandler = vi.fn();
    eventBus.on('folder.file_added', fileAddedHandler);

    folderWatcher.watch([testDir]);

    await new Promise((resolve) => setTimeout(resolve, 100));

    const mdFile = join(testDir, 'notes.md');
    writeFileSync(mdFile, '# Test');

    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(fileAddedHandler).toHaveBeenCalled();
    const calls = fileAddedHandler.mock.calls;
    const payload = calls.find((call) => call[0].path.includes('notes.md'))?.[0];
    if (payload) {
      expect(payload.kind).toBe('md');
    }
  });

  it('logs activity to the ActivityRepo', async () => {
    folderWatcher.watch([testDir]);

    await new Promise((resolve) => setTimeout(resolve, 100));

    const testFile = join(testDir, 'activity-test.txt');
    writeFileSync(testFile, 'content');

    await new Promise((resolve) => setTimeout(resolve, 100));

    const activities = activityRepo.listSince('2026-01-01T00:00:00.000Z');
    expect(activities.length).toBeGreaterThan(0);

    const fileActivity = activities.find((a) =>
      (a.payload as { path?: string }).path?.includes('activity-test.txt'),
    );
    expect(fileActivity).toBeDefined();
    if (fileActivity) {
      expect(fileActivity.kind).toMatch(/file_added|file_modified/);
    }
  });

  it('handles unwatching a folder', async () => {
    folderWatcher.watch([testDir]);
    await new Promise((resolve) => setTimeout(resolve, 50));

    const fileChangedHandler = vi.fn();
    eventBus.on('folder.file_changed', fileChangedHandler);

    folderWatcher.unwatch([testDir]);

    const testFile = join(testDir, 'test.txt');
    writeFileSync(testFile, 'content');

    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(fileChangedHandler).not.toHaveBeenCalled();
  });

  it('ignores .git and node_modules directories', async () => {
    const fileAddedHandler = vi.fn();
    eventBus.on('folder.file_added', fileAddedHandler);

    folderWatcher.watch([testDir]);

    await new Promise((resolve) => setTimeout(resolve, 100));

    mkdirSync(join(testDir, '.git'), { recursive: true });
    writeFileSync(join(testDir, '.git', 'config'), 'git config');

    mkdirSync(join(testDir, 'node_modules'), { recursive: true });
    writeFileSync(join(testDir, 'node_modules', 'package.json'), '{}');

    await new Promise((resolve) => setTimeout(resolve, 100));

    const calls = fileAddedHandler.mock.calls;
    const gitOrNodeModulesCalls = calls.filter(
      (call) => call[0].path.includes('.git') || call[0].path.includes('node_modules'),
    );

    expect(gitOrNodeModulesCalls.length).toBe(0);
  });

  it('does not log activity when fileWatchingEnabled is false', async () => {
    settingsRepo.update({ fileWatchingEnabled: false });
    folderWatcher.watch([testDir]);

    await new Promise((resolve) => setTimeout(resolve, 100));

    const testFile = join(testDir, 'test-disabled.txt');
    writeFileSync(testFile, 'content');

    await new Promise((resolve) => setTimeout(resolve, 100));

    const activities = activityRepo.listSince('2026-01-01T00:00:00.000Z');
    expect(activities).toHaveLength(0);
  });

  it('does not log activity when pauseAllTracking is true', async () => {
    settingsRepo.update({ pauseAllTracking: true });
    folderWatcher.watch([testDir]);

    await new Promise((resolve) => setTimeout(resolve, 100));

    const testFile = join(testDir, 'test-paused.txt');
    writeFileSync(testFile, 'content');

    await new Promise((resolve) => setTimeout(resolve, 100));

    const activities = activityRepo.listSince('2026-01-01T00:00:00.000Z');
    expect(activities).toHaveLength(0);
  });

  it('logs activity when both settings are enabled', async () => {
    settingsRepo.update({ fileWatchingEnabled: true, pauseAllTracking: false });
    folderWatcher.watch([testDir]);

    await new Promise((resolve) => setTimeout(resolve, 100));

    const testFile = join(testDir, 'test-enabled.txt');
    writeFileSync(testFile, 'content');

    await new Promise((resolve) => setTimeout(resolve, 100));

    const activities = activityRepo.listSince('2026-01-01T00:00:00.000Z');
    expect(activities.length).toBeGreaterThan(0);
  });
});
