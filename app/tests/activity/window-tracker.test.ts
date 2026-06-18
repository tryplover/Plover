import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { runMigrations } from '@main/store/db.js';
import { ActivityRepo } from '@main/store/repos/activity.js';
import { SettingsRepo } from '@main/store/repos/settings.js';
import { WindowTracker } from '@main/activity/window-tracker.js';

// Setup child_process mock
const mockExec = vi.fn();
vi.mock('node:child_process', () => ({
  execFile: (
    file: string,
    args: string[],
    callback: (error: Error | null, stdout: string, stderr: string) => void,
  ) => mockExec(file, callback),
}));

describe('WindowTracker', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('logs window focus activity on first check', async () => {
    const db = new Database(':memory:');
    runMigrations(db);
    const activityRepo = new ActivityRepo(db);
    const settingsRepo = new SettingsRepo(db);
    settingsRepo.update({ pauseScheduling: false });

    const tracker = new WindowTracker(activityRepo, settingsRepo);

    mockExec.mockImplementation((_cmd, cb) => {
      cb(null, 'Safari|||Google Search', '');
    });

    await tracker.checkActiveWindow();

    const logs = activityRepo.list();
    expect(logs).toHaveLength(1);
    expect(logs[0]?.kind).toBe('window_focus');
    expect(logs[0]?.payload).toEqual({
      app: 'Safari',
      title: 'Google Search',
    });
  });

  it('does not log if AppleScript command execution fails', async () => {
    const db = new Database(':memory:');
    runMigrations(db);
    const activityRepo = new ActivityRepo(db);
    const settingsRepo = new SettingsRepo(db);
    settingsRepo.update({ pauseScheduling: false });

    const tracker = new WindowTracker(activityRepo, settingsRepo);

    mockExec.mockImplementation((_cmd, cb) => {
      cb(new Error('AppleScript execution failed'), '', 'Some error');
    });

    await tracker.checkActiveWindow();

    const logs = activityRepo.list();
    expect(logs).toHaveLength(0);
  });

  it('only logs on change unless 60 seconds have passed', async () => {
    const db = new Database(':memory:');
    runMigrations(db);
    const activityRepo = new ActivityRepo(db);
    const settingsRepo = new SettingsRepo(db);
    settingsRepo.update({ pauseScheduling: false });

    const tracker = new WindowTracker(activityRepo, settingsRepo);

    // First check: Safari
    mockExec.mockImplementation((_cmd, cb) => {
      cb(null, 'Safari|||Google Search', '');
    });
    await tracker.checkActiveWindow();
    expect(activityRepo.list()).toHaveLength(1);

    // Second check: Still Safari, within 60 seconds (10s passed)
    vi.advanceTimersByTime(10000);
    await tracker.checkActiveWindow();
    expect(activityRepo.list()).toHaveLength(1); // No new log

    // Third check: Window changes to Slack (20s total passed)
    mockExec.mockImplementation((_cmd, cb) => {
      cb(null, 'Slack|||General', '');
    });
    vi.advanceTimersByTime(10000);
    await tracker.checkActiveWindow();
    expect(activityRepo.list()).toHaveLength(2);
    expect(activityRepo.list()[1]?.payload).toEqual({
      app: 'Slack',
      title: 'General',
    });
  });

  it('logs again if same window remains active for 60 seconds', async () => {
    const db = new Database(':memory:');
    runMigrations(db);
    const activityRepo = new ActivityRepo(db);
    const settingsRepo = new SettingsRepo(db);
    settingsRepo.update({ pauseScheduling: false });

    const tracker = new WindowTracker(activityRepo, settingsRepo);

    // First check: Safari
    mockExec.mockImplementation((_cmd, cb) => {
      cb(null, 'Safari|||Google Search', '');
    });
    await tracker.checkActiveWindow();
    expect(activityRepo.list()).toHaveLength(1);

    // Keep checking Safari every 10 seconds.
    // Total elapsed: 10s, 20s, 30s, 40s, 50s - should not log
    for (let i = 0; i < 5; i++) {
      vi.advanceTimersByTime(10000);
      await tracker.checkActiveWindow();
      expect(activityRepo.list()).toHaveLength(1);
    }

    // Next check: 60s total passed since last log
    vi.advanceTimersByTime(10000);
    await tracker.checkActiveWindow();
    expect(activityRepo.list()).toHaveLength(2);
    expect(activityRepo.list()[1]?.payload).toEqual({
      app: 'Safari',
      title: 'Google Search',
    });
  });

  it('does not log or call child_process if monitoring is paused', async () => {
    const db = new Database(':memory:');
    runMigrations(db);
    const activityRepo = new ActivityRepo(db);
    const settingsRepo = new SettingsRepo(db);
    settingsRepo.update({ pauseScheduling: true });

    const tracker = new WindowTracker(activityRepo, settingsRepo);

    await tracker.checkActiveWindow();

    expect(mockExec).not.toHaveBeenCalled();
    expect(activityRepo.list()).toHaveLength(0);
  });

  it('sets up interval when start is called and clears on stop', async () => {
    const db = new Database(':memory:');
    runMigrations(db);
    const activityRepo = new ActivityRepo(db);
    const settingsRepo = new SettingsRepo(db);
    settingsRepo.update({ pauseScheduling: false });

    const tracker = new WindowTracker(activityRepo, settingsRepo);

    mockExec.mockImplementation((_cmd, cb) => {
      cb(null, 'Safari|||Home', '');
    });

    tracker.start();

    // Advance by 10s to trigger first interval execution
    await vi.advanceTimersByTimeAsync(10000);
    expect(mockExec).toHaveBeenCalledTimes(1);
    expect(activityRepo.list()).toHaveLength(1);

    // Advance by another 10s to trigger second interval execution
    await vi.advanceTimersByTimeAsync(10000);
    expect(mockExec).toHaveBeenCalledTimes(2);

    tracker.stop();

    // Advance again by 10s, should not call exec anymore
    await vi.advanceTimersByTimeAsync(10000);
    expect(mockExec).toHaveBeenCalledTimes(2);
  });
});
