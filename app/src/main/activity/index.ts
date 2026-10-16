import {
  createActivitySubscribers,
  ActivitySubscriberGroup,
} from './sources/activity-subscriber.js';
import { GOOGLE_SUBSCRIBER_SPECS } from './sources/google/subscribers.js';
import { GITHUB_SUBSCRIBER_SPECS } from './sources/github/subscribers.js';
import { InferenceEngine } from './processing/inference/index.js';
import { CommitTaskMatcher } from './processing/commit-task-matcher/index.js';
import { runRetention } from './processing/retention/index.js';
import { settingsRepo, activityRepo, tasksRepo, summariesRepo, db } from '../store/index.js';
import { eventBus } from '../events/bus.js';

let busSubscribers: ActivitySubscriberGroup | null = null;
let inferenceEngine: InferenceEngine | null = null;
let commitTaskMatcher: CommitTaskMatcher | null = null;
let retentionIntervalId: NodeJS.Timeout | null = null;

export async function initActivityMonitoring(): Promise<void> {
  console.log('[Activity] Initializing active monitoring subsystems...');

  if (!busSubscribers) {
    busSubscribers = createActivitySubscribers(
      [...GOOGLE_SUBSCRIBER_SPECS, ...GITHUB_SUBSCRIBER_SPECS],
      { activityRepo, settingsRepo, eventBus },
    );
    busSubscribers.start();
  }

  // The buddy pivot starts no screen capture, Vision, window, folder, or git collection, even for
  // profiles that saved the old flags. Those sources are kept for possible opt-in reuse; wire them
  // back here deliberately. Retention keeps trimming existing activity data.

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
  if (inferenceEngine) {
    inferenceEngine.stop();
    inferenceEngine = null;
  }
  if (commitTaskMatcher) {
    commitTaskMatcher.stop();
    commitTaskMatcher = null;
  }
  if (busSubscribers) {
    busSubscribers.stop();
    busSubscribers = null;
  }
  if (retentionIntervalId) {
    clearInterval(retentionIntervalId);
    retentionIntervalId = null;
  }
}
