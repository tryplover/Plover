import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const constructed = vi.hoisted(() => ({
  screenCapturer: 0,
  windowTracker: 0,
  folderWatcher: 0,
  gitCommitTracker: 0,
  retentionRuns: 0,
}));

vi.mock('electron', () => ({ app: { getPath: vi.fn(() => '/tmp/plover-lifecycle-test') } }));

vi.mock('@main/activity/sources/system/screen-capturer/index.js', () => ({
  ScreenCapturer: class {
    constructor() {
      constructed.screenCapturer += 1;
    }
    start = () => undefined;
    stop = () => undefined;
  },
}));

vi.mock('@main/activity/sources/system/window-tracker/index.js', () => ({
  WindowTracker: class {
    constructor() {
      constructed.windowTracker += 1;
    }
    start = () => undefined;
    stop = () => undefined;
  },
}));

vi.mock('@main/activity/sources/system/folder-watcher/index.js', () => ({
  FolderWatcher: class {
    constructor() {
      constructed.folderWatcher += 1;
    }
    watch = async () => undefined;
    closeAllWatchers = async () => undefined;
  },
}));

vi.mock('@main/activity/sources/git/git-commit-tracker/index.js', () => ({
  GitCommitTracker: class {
    constructor() {
      constructed.gitCommitTracker += 1;
    }
    start = () => undefined;
    stop = () => undefined;
  },
}));

vi.mock('@main/activity/sources/activity-subscriber.js', () => ({
  createActivitySubscribers: () => ({ start: () => undefined, stop: () => undefined }),
}));

vi.mock('@main/activity/processing/inference/index.js', () => ({
  InferenceEngine: class {
    start = () => undefined;
    stop = () => undefined;
  },
}));

vi.mock('@main/activity/processing/commit-task-matcher/index.js', () => ({
  CommitTaskMatcher: class {
    start = () => undefined;
    stop = () => undefined;
  },
}));

vi.mock('@main/activity/processing/retention/index.js', () => ({
  runRetention: async () => {
    constructed.retentionRuns += 1;
  },
}));

import { settingsRepo } from '@main/store/index.js';
import { initActivityMonitoring, stopActivityMonitoring } from '@main/activity/index.js';

const originalPlatform = Object.getOwnPropertyDescriptor(process, 'platform');

function enableLegacyTracking() {
  settingsRepo.update({
    screenCaptureEnabled: true,
    screenVisionInferenceEnabled: true,
    windowTrackingEnabled: true,
    fileWatchingEnabled: true,
    pauseAllTracking: false,
    watchedFolders: ['/tmp/plover-lifecycle-watched'],
  });
}

describe('activity monitoring lifecycle', () => {
  beforeEach(() => {
    constructed.screenCapturer = 0;
    constructed.windowTracker = 0;
    constructed.folderWatcher = 0;
    constructed.gitCommitTracker = 0;
    constructed.retentionRuns = 0;
    Object.defineProperty(process, 'platform', { value: 'darwin' });
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    stopActivityMonitoring();
    if (originalPlatform) Object.defineProperty(process, 'platform', originalPlatform);
    vi.restoreAllMocks();
  });

  it('never starts screen capture, even with legacy capture and vision flags enabled', async () => {
    enableLegacyTracking();

    await initActivityMonitoring();

    expect(constructed.retentionRuns).toBe(1);
    expect(constructed.screenCapturer).toBe(0);
  });

  it('starts no local collectors, even with legacy tracking flags and watched folders', async () => {
    enableLegacyTracking();

    await initActivityMonitoring();

    expect(constructed.retentionRuns).toBe(1);
    expect(constructed.windowTracker).toBe(0);
    expect(constructed.folderWatcher).toBe(0);
    expect(constructed.gitCommitTracker).toBe(0);
  });

  it('stays frozen on repeated init while retention keeps running', async () => {
    enableLegacyTracking();

    await initActivityMonitoring();
    await initActivityMonitoring();

    expect(constructed.retentionRuns).toBe(2);
    expect(constructed.screenCapturer).toBe(0);
    expect(constructed.windowTracker).toBe(0);
    expect(constructed.folderWatcher).toBe(0);
    expect(constructed.gitCommitTracker).toBe(0);
  });
});
