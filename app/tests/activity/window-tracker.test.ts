import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { runMigrations } from '@main/store/db.js';
import { ActivityRepo } from '@main/store/repos/activity.js';
import { SettingsRepo } from '@main/store/repos/settings.js';
import { WindowTracker } from '@main/activity/window-tracker.js';

// Setup get-windows mock
const mockActiveWindow = vi.fn();
const mockOpenWindows = vi.fn();
vi.mock('get-windows', () => ({
  activeWindow: () => mockActiveWindow(),
  openWindows: () => mockOpenWindows(),
}));

describe('WindowTracker', () => {
  const originalPlatform = process.platform;

  beforeEach(() => {
    Object.defineProperty(process, 'platform', {
      value: 'darwin',
      configurable: true,
    });
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    Object.defineProperty(process, 'platform', {
      value: originalPlatform,
      configurable: true,
    });
    vi.useRealTimers();
  });

  it('logs window focus activity on first check', async () => {
    const db = new Database(':memory:');
    runMigrations(db);
    const activityRepo = new ActivityRepo(db);
    const settingsRepo = new SettingsRepo(db);
    settingsRepo.update({ pauseScheduling: false });

    const tracker = new WindowTracker(activityRepo, settingsRepo);

    mockActiveWindow.mockResolvedValue({
      owner: { name: 'Safari' },
      title: 'Google Search',
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

  it('does not log if activeWindow throws an error', async () => {
    const db = new Database(':memory:');
    runMigrations(db);
    const activityRepo = new ActivityRepo(db);
    const settingsRepo = new SettingsRepo(db);
    settingsRepo.update({ pauseScheduling: false });

    const tracker = new WindowTracker(activityRepo, settingsRepo);

    mockActiveWindow.mockRejectedValue(new Error('activeWindow failed'));

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
    mockActiveWindow.mockResolvedValue({
      owner: { name: 'Safari' },
      title: 'Google Search',
    });
    await tracker.checkActiveWindow();
    expect(activityRepo.list()).toHaveLength(1);

    // Second check: Still Safari, within 60 seconds (10s passed)
    vi.advanceTimersByTime(10000);
    await tracker.checkActiveWindow();
    expect(activityRepo.list()).toHaveLength(1); // No new log

    // Third check: Window changes to Slack (20s total passed)
    mockActiveWindow.mockResolvedValue({
      owner: { name: 'Slack' },
      title: 'General',
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
    mockActiveWindow.mockResolvedValue({
      owner: { name: 'Safari' },
      title: 'Google Search',
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

  it('does not log or call activeWindow if monitoring is paused', async () => {
    const db = new Database(':memory:');
    runMigrations(db);
    const activityRepo = new ActivityRepo(db);
    const settingsRepo = new SettingsRepo(db);
    settingsRepo.update({ pauseScheduling: true });

    const tracker = new WindowTracker(activityRepo, settingsRepo);

    await tracker.checkActiveWindow();

    expect(mockActiveWindow).not.toHaveBeenCalled();
    expect(activityRepo.list()).toHaveLength(0);
  });

  it('sets up interval when start is called and clears on stop', async () => {
    const db = new Database(':memory:');
    runMigrations(db);
    const activityRepo = new ActivityRepo(db);
    const settingsRepo = new SettingsRepo(db);
    settingsRepo.update({ pauseScheduling: false });

    const tracker = new WindowTracker(activityRepo, settingsRepo);

    mockActiveWindow.mockResolvedValue({
      owner: { name: 'Safari' },
      title: 'Home',
    });

    tracker.start();

    // Advance by 10s to trigger first interval execution
    await vi.advanceTimersByTimeAsync(10000);
    expect(mockActiveWindow).toHaveBeenCalledTimes(1);
    expect(activityRepo.list()).toHaveLength(1);

    // Advance by another 10s to trigger second interval execution
    await vi.advanceTimersByTimeAsync(10000);
    expect(mockActiveWindow).toHaveBeenCalledTimes(2);

    tracker.stop();

    // Advance again by 10s, should not call exec anymore
    await vi.advanceTimersByTimeAsync(10000);
    expect(mockActiveWindow).toHaveBeenCalledTimes(2);
  });
});

describe('listActiveWindows', () => {
  it('returns list of active windows filtered by platform', async () => {
    const { listActiveWindows } = await import('@main/activity/window-tracker.js');

    mockOpenWindows.mockResolvedValue([
      { owner: { name: 'Safari' }, title: 'Google Search' },
      { owner: { name: 'Finder' }, title: 'Desktop' },
      { owner: { name: 'Slack' }, title: 'Unknown' },
      { owner: { name: 'explorer' }, title: 'Desktop' },
    ]);

    // Test for 'darwin' (macOS)
    Object.defineProperty(process, 'platform', {
      value: 'darwin',
      configurable: true,
    });
    let result = await listActiveWindows();
    expect(result).toEqual([
      { app: 'Safari', title: 'Google Search' },
      { app: 'explorer', title: 'Desktop' },
    ]);

    // Test for 'win32' (Windows)
    Object.defineProperty(process, 'platform', {
      value: 'win32',
      configurable: true,
    });
    result = await listActiveWindows();
    expect(result).toEqual([
      { app: 'Safari', title: 'Google Search' },
      { app: 'Finder', title: 'Desktop' },
    ]);
  });
});
