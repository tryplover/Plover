import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const constructed = vi.hoisted(() => ({ screenCapturer: 0, windowTracker: 0 }));

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

vi.mock('@main/activity/sources/activity-subscriber.js', () => ({
  createActivitySubscribers: () => ({ start: () => undefined, stop: () => undefined }),
}));

vi.mock('@main/activity/sources/system/folder-watcher/index.js', () => ({
  FolderWatcher: class {
    watch = async () => undefined;
    closeAllWatchers = async () => undefined;
  },
}));

vi.mock('@main/activity/processing/inference/index.js', () => ({
  InferenceEngine: class {
    start = () => undefined;
    stop = () => undefined;
  },
}));

vi.mock('@main/activity/sources/git/git-commit-tracker/index.js', () => ({
  GitCommitTracker: class {
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
  runRetention: async () => undefined,
}));

import { settingsRepo } from '@main/store/index.js';
import { initActivityMonitoring, stopActivityMonitoring } from '@main/activity/index.js';

const originalPlatform = Object.getOwnPropertyDescriptor(process, 'platform');

describe('activity monitoring lifecycle', () => {
  beforeEach(() => {
    constructed.screenCapturer = 0;
    constructed.windowTracker = 0;
    Object.defineProperty(process, 'platform', { value: 'darwin' });
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    stopActivityMonitoring();
    if (originalPlatform) Object.defineProperty(process, 'platform', originalPlatform);
    vi.restoreAllMocks();
  });

  it('never starts screen capture, even with legacy capture and vision flags enabled', async () => {
    settingsRepo.update({ screenCaptureEnabled: true, screenVisionInferenceEnabled: true });

    await initActivityMonitoring();

    expect(constructed.windowTracker).toBe(1);
    expect(constructed.screenCapturer).toBe(0);
  });

  it('does not construct a screen capturer on repeated init either', async () => {
    settingsRepo.update({ screenCaptureEnabled: true, screenVisionInferenceEnabled: true });

    await initActivityMonitoring();
    await initActivityMonitoring();

    expect(constructed.windowTracker).toBe(1);
    expect(constructed.screenCapturer).toBe(0);
  });
});
