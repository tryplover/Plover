import { app } from 'electron';
import { WindowTracker } from './sources/system/window-tracker/index.js';
import {
  createActivitySubscribers,
  ActivitySubscriberGroup,
} from './sources/activity-subscriber.js';
import { GOOGLE_SUBSCRIBER_SPECS } from './sources/google/subscribers.js';
import { GITHUB_SUBSCRIBER_SPECS } from './sources/github/subscribers.js';
import { ScreenCapturer } from './sources/system/screen-capturer/index.js';
import { FolderWatcher } from './sources/system/folder-watcher/index.js';
import { InferenceEngine } from './processing/inference/index.js';
import { GitCommitTracker } from './sources/git/git-commit-tracker/index.js';
import { CommitTaskMatcher } from './processing/commit-task-matcher/index.js';
import { runRetention } from './processing/retention/index.js';
import { settingsRepo, activityRepo, tasksRepo, summariesRepo, db } from '../store/index.js';
import { eventBus } from '../events/bus.js';

let windowTracker: WindowTracker | null = null;
let busSubscribers: ActivitySubscriberGroup | null = null;
let screenCapturer: ScreenCapturer | null = null;
let folderWatcher: FolderWatcher | null = null;
let inferenceEngine: InferenceEngine | null = null;
let gitCommitTracker: GitCommitTracker | null = null;
let commitTaskMatcher: CommitTaskMatcher | null = null;
let retentionIntervalId: NodeJS.Timeout | null = null;

export async function initActivityMonitoring(): Promise<void> {
  console.log('[Activity] Initializing active monitoring subsystems...');

  if (process.platform === 'darwin' || process.platform === 'win32') {
    if (!windowTracker) {
      windowTracker = new WindowTracker(activityRepo, settingsRepo);
      windowTracker.start();
    }
  } else {
    console.log('[Activity] Window tracking is only supported on macOS and Windows. Skipping.');
  }

  if (!busSubscribers) {
    busSubscribers = createActivitySubscribers(
      [...GOOGLE_SUBSCRIBER_SPECS, ...GITHUB_SUBSCRIBER_SPECS],
      { activityRepo, settingsRepo, eventBus },
    );
    busSubscribers.start();
  }

  if ((process.platform === 'darwin' || process.platform === 'win32') && !screenCapturer) {
    screenCapturer = new ScreenCapturer({
      activityRepo,
      settingsRepo,
      userDataDir: app.getPath('userData'),
    });
    screenCapturer.start();
  }

  if (!folderWatcher) {
    folderWatcher = new FolderWatcher(activityRepo, settingsRepo, eventBus);
    const settings = settingsRepo.getAll();
    if (settings.watchedFolders.length > 0) {
      await folderWatcher.watch(settings.watchedFolders);
    }
  }

  if (!inferenceEngine) {
    inferenceEngine = new InferenceEngine(
      tasksRepo,
      activityRepo,
      summariesRepo,
      settingsRepo,
      eventBus,
      db,
    );
    inferenceEngine.start();
  }

  if (!gitCommitTracker) {
    gitCommitTracker = new GitCommitTracker(activityRepo, eventBus);
    gitCommitTracker.start();
  }

  if (!commitTaskMatcher) {
    commitTaskMatcher = new CommitTaskMatcher(tasksRepo, summariesRepo, eventBus);
    commitTaskMatcher.start();
  }

  void runRetention({ activityRepo, settingsRepo, now: new Date() }).catch((err) =>
    console.error('[Activity] retention failed:', err),
  );
  if (!retentionIntervalId) {
    retentionIntervalId = setInterval(
      () => {
        void runRetention({ activityRepo, settingsRepo, now: new Date() }).catch((err) =>
          console.error('[Activity] retention failed:', err),
        );
      },
      6 * 60 * 60 * 1000,
    );
  }
}

export function stopActivityMonitoring(): void {
  console.log('[Activity] Stopping active monitoring subsystems...');
  if (folderWatcher) {
    void folderWatcher.closeAllWatchers();
    folderWatcher = null;
  }
  if (inferenceEngine) {
    inferenceEngine.stop();
    inferenceEngine = null;
  }
  if (gitCommitTracker) {
    gitCommitTracker.stop();
    gitCommitTracker = null;
  }
  if (commitTaskMatcher) {
    commitTaskMatcher.stop();
    commitTaskMatcher = null;
  }
  if (windowTracker) {
    windowTracker.stop();
    windowTracker = null;
  }
  if (busSubscribers) {
    busSubscribers.stop();
    busSubscribers = null;
  }
  if (screenCapturer) {
    screenCapturer.stop();
    screenCapturer = null;
  }
  if (retentionIntervalId) {
    clearInterval(retentionIntervalId);
    retentionIntervalId = null;
  }
}
