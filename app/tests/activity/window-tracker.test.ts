import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { runMigrations } from '@main/store/db.js';
import { ActivityRepo } from '@main/store/repos/activity.js';
import { SettingsRepo } from '@main/store/repos/settings.js';
import { WindowTracker } from '@main/activity/sources/system/window-tracker/index.js';

// Setup electron mock
const { getMediaAccessStatus } = vi.hoisted(() => ({
  getMediaAccessStatus: vi.fn().mockReturnValue('granted'),
}));
vi.mock('electron', () => ({
  systemPreferences: { getMediaAccessStatus },
}));

// Setup get-windows mock
const mockActiveWindow = vi.fn();
const mockOpenWindows = vi.fn();
vi.mock('get-windows', () => ({
  activeWindow: () => mockActiveWindow(),
  openWindows: () => mockOpenWindows(),
}));

// Setup execFile mock
const mockExecFile = vi.fn();
vi.mock('node:child_process', () => ({
  execFile: (
    cmd: string,
    args: string[],
    opts: object,
    cb: (err: Error | null, stdout: string, stderr: string) => void,
  ) => {
    mockExecFile(cmd, args, opts, cb);
  },
}));

describe('WindowTracker', () => {
  beforeEach(() => {
    vi.spyOn(process, 'platform', 'get').mockReturnValue('darwin');
    vi.useFakeTimers();
    vi.clearAllMocks();
    getMediaAccessStatus.mockReset();
    getMediaAccessStatus.mockReturnValue('granted');
    vi.spyOn(process, 'platform', 'get').mockReturnValue('darwin');
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    vi.restoreAllMocks();
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
    expect(activityRepo.list()[0]?.payload).toEqual({
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
    expect(activityRepo.list()[0]?.payload).toEqual({
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

describe('WindowTracker — enhanced metadata', () => {
  let db: Database.Database;
  let activityRepo: ActivityRepo;
  let settingsRepo: SettingsRepo;
  let tracker: WindowTracker;
  const realPlatform = process.platform;

  beforeEach(() => {
    Object.defineProperty(process, 'platform', { value: 'darwin', configurable: true });
    db = new Database(':memory:');
    runMigrations(db);
    activityRepo = new ActivityRepo(db);
    settingsRepo = new SettingsRepo(db);
    settingsRepo.update({ pauseScheduling: false });
    tracker = new WindowTracker(activityRepo, settingsRepo);
    mockActiveWindow.mockReset();
    mockExecFile.mockReset();
    getMediaAccessStatus.mockReset();
    getMediaAccessStatus.mockReturnValue('granted');
  });

  afterEach(() => {
    Object.defineProperty(process, 'platform', { value: realPlatform, configurable: true });
  });

  it('logs bundleId from get-windows owner', async () => {
    mockActiveWindow.mockResolvedValue({
      owner: { name: 'Slack', bundleId: 'com.tinyspeck.slackmacgap' },
      title: '#engineering',
    });
    await tracker.checkActiveWindow();
    const rows = activityRepo.list();
    const row = rows[0];
    if (row?.kind === 'window_focus') {
      expect(row.payload.bundleId).toBe('com.tinyspeck.slackmacgap');
    } else {
      throw new Error('Expected window_focus log');
    }
  });

  it('captures browser URL for Chrome via osascript', async () => {
    mockActiveWindow.mockResolvedValue({
      owner: { name: 'Google Chrome', bundleId: 'com.google.Chrome' },
      title: 'Plover - GitHub',
    });
    mockExecFile.mockImplementationOnce((_cmd, _args, _opts, cb) =>
      cb(null, 'https://github.com/foo/plover\nPlover · GitHub', ''),
    );
    await tracker.checkActiveWindow();
    const row = activityRepo.list()[0];
    if (row?.kind === 'window_focus') {
      expect(row.payload.browserUrl).toBe('https://github.com/foo/plover');
      expect(row.payload.browserTabTitle).toBe('Plover · GitHub');
    } else {
      throw new Error('Expected window_focus log');
    }
  });

  it('omits browser fields cleanly when osascript fails', async () => {
    mockActiveWindow.mockResolvedValue({
      owner: { name: 'Safari', bundleId: 'com.apple.Safari' },
      title: 'Some Page',
    });
    mockExecFile.mockImplementationOnce((_cmd, _args, _opts, cb) =>
      cb(new Error('not allowed'), '', ''),
    );
    await tracker.checkActiveWindow();
    const row = activityRepo.list()[0];
    if (row?.kind === 'window_focus') {
      expect(row.payload.app).toBe('Safari');
      expect(row.payload.browserUrl).toBeUndefined();
    } else {
      throw new Error('Expected window_focus log');
    }
  });

  it('does not call osascript for non-browser apps', async () => {
    mockActiveWindow.mockResolvedValue({
      owner: { name: 'Terminal', bundleId: 'com.apple.Terminal' },
      title: 'zsh',
    });
    await tracker.checkActiveWindow();
    expect(mockExecFile).not.toHaveBeenCalled();
  });

  it('does not log window focus or call get-windows if screen recording permission is not granted', async () => {
    getMediaAccessStatus.mockReturnValue('denied');
    mockActiveWindow.mockResolvedValue({
      owner: { name: 'Terminal', bundleId: 'com.apple.Terminal' },
      title: 'zsh',
    });
    await tracker.checkActiveWindow();
    expect(mockActiveWindow).not.toHaveBeenCalled();
    const logs = activityRepo.list();
    expect(logs).toHaveLength(0);
  });
});
