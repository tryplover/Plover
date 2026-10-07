import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const lifecycle = () => ({ start: vi.fn(), stop: vi.fn() });
  return {
    window: lifecycle(),
    subscribers: lifecycle(),
    screen: lifecycle(),
    folder: { watch: vi.fn().mockResolvedValue(undefined), closeAllWatchers: vi.fn() },
    git: lifecycle(),
    matcher: lifecycle(),
    matcherConstructor: vi.fn(),
    inference: lifecycle(),
    inferenceConstructor: vi.fn(),
    retention: vi.fn().mockResolvedValue(undefined),
  };
});

vi.mock('electron', () => ({ app: { getPath: () => '/test' } }));
vi.mock('../../src/main/store/index', () => ({
  settingsRepo: { getAll: () => ({ watchedFolders: ['/work'] }) },
  activityRepo: {},
  tasksRepo: {},
  summariesRepo: {},
  db: {},
}));
vi.mock('../../src/main/events/bus', () => ({ eventBus: {} }));
vi.mock('../../src/main/activity/sources/system/window-tracker/index', () => ({
  WindowTracker: vi.fn(function () {
    return mocks.window;
  }),
}));
vi.mock('../../src/main/activity/sources/activity-subscriber', () => ({
  createActivitySubscribers: () => mocks.subscribers,
}));
vi.mock('../../src/main/activity/sources/system/screen-capturer/index', () => ({
  ScreenCapturer: vi.fn(function () {
    return mocks.screen;
  }),
}));
vi.mock('../../src/main/activity/sources/system/folder-watcher/index', () => ({
  FolderWatcher: vi.fn(function () {
    return mocks.folder;
  }),
}));
vi.mock('../../src/main/activity/sources/git/git-commit-tracker/index', () => ({
  GitCommitTracker: vi.fn(function () {
    return mocks.git;
  }),
}));
vi.mock('../../src/main/activity/processing/commit-task-matcher/index', () => ({
  CommitTaskMatcher: vi.fn(function (...args: unknown[]) {
    mocks.matcherConstructor(...args);
    return mocks.matcher;
  }),
}));
vi.mock('../../src/main/activity/processing/inference/index', () => ({
  InferenceEngine: vi.fn(function (...args: unknown[]) {
    mocks.inferenceConstructor(...args);
    return mocks.inference;
  }),
}));
vi.mock('../../src/main/activity/processing/retention/index', () => ({
  runRetention: mocks.retention,
}));

import { initActivityMonitoring, stopActivityMonitoring } from '../../src/main/activity/index';

const collectors = [mocks.window, mocks.subscribers, mocks.screen, mocks.git];
const originalPlatform = process.platform;

describe('activity lifecycle without automatic progress inference', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    Object.defineProperty(process, 'platform', { value: 'darwin', configurable: true });
    vi.clearAllMocks();
  });

  afterEach(() => {
    stopActivityMonitoring();
    Object.defineProperty(process, 'platform', { value: originalPlatform, configurable: true });
    vi.useRealTimers();
  });

  it('keeps collection and retention running without starting progress inference', async () => {
    await initActivityMonitoring();
    await initActivityMonitoring();
    await vi.advanceTimersByTimeAsync(6 * 60 * 60 * 1000);

    expect(mocks.inferenceConstructor).not.toHaveBeenCalled();
    expect(mocks.inference.start).not.toHaveBeenCalled();
    for (const collector of collectors) {
      expect(collector.start).toHaveBeenCalledTimes(1);
    }
    expect(mocks.folder.watch).toHaveBeenCalledExactlyOnceWith(['/work']);
    expect(mocks.retention).toHaveBeenCalledTimes(3);
  });

  it('never starts automatic commit matching across initialization and restart', async () => {
    await initActivityMonitoring();
    await initActivityMonitoring();
    stopActivityMonitoring();
    await initActivityMonitoring();
    await vi.advanceTimersByTimeAsync(6 * 60 * 60 * 1000);

    expect(mocks.matcherConstructor).not.toHaveBeenCalled();
    expect(mocks.matcher.start).not.toHaveBeenCalled();
    expect(mocks.git.start).toHaveBeenCalledTimes(2);
    expect(mocks.git.stop).toHaveBeenCalledTimes(1);
  });

  it('stops collectors and retention and can restart without inference', async () => {
    await initActivityMonitoring();
    stopActivityMonitoring();
    stopActivityMonitoring();
    await vi.advanceTimersByTimeAsync(6 * 60 * 60 * 1000);

    for (const collector of collectors) {
      expect(collector.stop).toHaveBeenCalledTimes(1);
    }
    expect(mocks.folder.closeAllWatchers).toHaveBeenCalledTimes(1);
    expect(mocks.retention).toHaveBeenCalledTimes(1);

    await initActivityMonitoring();
    for (const collector of collectors) {
      expect(collector.start).toHaveBeenCalledTimes(2);
    }
    expect(mocks.inferenceConstructor).not.toHaveBeenCalled();
    expect(mocks.inference.start).not.toHaveBeenCalled();
  });
});
