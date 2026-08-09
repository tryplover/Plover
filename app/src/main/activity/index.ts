import { app } from 'electron';
import { WindowTracker } from './sources/system/window-tracker/index.js';
import { GDocsActivitySubscriber } from './sources/google/gdocs-subscriber/index.js';
import { GmailActivitySubscriber } from './sources/google/gmail-subscriber/gmail-subscriber.js';
import { CalendarActivitySubscriber } from './sources/google/calendar-subscriber/calendar-subscriber.js';
import { ClassroomActivitySubscriber } from './sources/google/classroom-subscriber/classroom-subscriber.js';
import { GitHubCommitActivitySubscriber } from './sources/github/github-commit-subscriber/github-commit-subscriber.js';
import { GitHubPrActivitySubscriber } from './sources/github/github-pr-subscriber/github-pr-subscriber.js';
import { GitHubReviewActivitySubscriber } from './sources/github/github-review-subscriber/github-review-subscriber.js';
import { ScreenCapturer } from './sources/system/screen-capturer/index.js';
import { FolderWatcher } from './sources/system/folder-watcher/index.js';
import { InferenceEngine } from './processing/inference/index.js';
import { GitCommitTracker } from './sources/git/git-commit-tracker/index.js';
import { CommitTaskMatcher } from './processing/commit-task-matcher/index.js';
import { runRetention } from './processing/retention/index.js';
import { settingsRepo, activityRepo, tasksRepo, summariesRepo, db } from '../store/index.js';
import { eventBus } from '../events/bus.js';

let windowTracker: WindowTracker | null = null;
let gdocsSubscriber: GDocsActivitySubscriber | null = null;
let gmailSubscriber: GmailActivitySubscriber | null = null;
let calendarSubscriber: CalendarActivitySubscriber | null = null;
let classroomSubscriber: ClassroomActivitySubscriber | null = null;
let githubCommitSubscriber: GitHubCommitActivitySubscriber | null = null;
let githubPrSubscriber: GitHubPrActivitySubscriber | null = null;
let githubReviewSubscriber: GitHubReviewActivitySubscriber | null = null;
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

  if (!gdocsSubscriber) {
    gdocsSubscriber = new GDocsActivitySubscriber(activityRepo, settingsRepo, eventBus);
    gdocsSubscriber.start();
  }

  if (!gmailSubscriber) {
    gmailSubscriber = new GmailActivitySubscriber(activityRepo, settingsRepo, eventBus);
    gmailSubscriber.start();
  }

  if (!calendarSubscriber) {
    calendarSubscriber = new CalendarActivitySubscriber(activityRepo, settingsRepo, eventBus);
    calendarSubscriber.start();
  }

  if (!classroomSubscriber) {
    classroomSubscriber = new ClassroomActivitySubscriber(activityRepo, settingsRepo, eventBus);
    classroomSubscriber.start();
  }

  if (!githubCommitSubscriber) {
    githubCommitSubscriber = new GitHubCommitActivitySubscriber(activityRepo, settingsRepo, eventBus);
    githubCommitSubscriber.start();
  }

  if (!githubPrSubscriber) {
    githubPrSubscriber = new GitHubPrActivitySubscriber(activityRepo, settingsRepo, eventBus);
    githubPrSubscriber.start();
  }

  if (!githubReviewSubscriber) {
    githubReviewSubscriber = new GitHubReviewActivitySubscriber(activityRepo, settingsRepo, eventBus);
    githubReviewSubscriber.start();
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
  if (gdocsSubscriber) {
    gdocsSubscriber.stop();
    gdocsSubscriber = null;
  }
  if (gmailSubscriber) {
    gmailSubscriber.stop();
    gmailSubscriber = null;
  }
  if (calendarSubscriber) {
    calendarSubscriber.stop();
    calendarSubscriber = null;
  }
  if (classroomSubscriber) {
    classroomSubscriber.stop();
    classroomSubscriber = null;
  }
  if (githubCommitSubscriber) {
    githubCommitSubscriber.stop();
    githubCommitSubscriber = null;
  }
  if (githubPrSubscriber) {
    githubPrSubscriber.stop();
    githubPrSubscriber = null;
  }
  if (githubReviewSubscriber) {
    githubReviewSubscriber.stop();
    githubReviewSubscriber = null;
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
