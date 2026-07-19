import { app } from 'electron';
import { WindowTracker } from './window-tracker.js';
import { GDocsActivitySubscriber } from './gdocs-subscriber.js';
import { ScreenCapturer } from './screen-capturer.js';
import { runRetention } from './retention.js';
import { settingsRepo, activityRepo } from '../store/index.js';
import { eventBus } from '../bus.js';

let windowTracker: WindowTracker | null = null;
let gdocsSubscriber: GDocsActivitySubscriber | null = null;
let screenCapturer: ScreenCapturer | null = null;
let retentionIntervalId: NodeJS.Timeout | null = null;

export function initActivityMonitoring(): void {
  console.log('[Activity] Initializing active monitoring subsystems...');

  // Initialize and start Window Tracker (ticks every 10 seconds, macOS only)
  if (process.platform === 'darwin') {
    if (!windowTracker) {
      console.log('[Activity] Initializing active window tracker...');
      windowTracker = new WindowTracker(activityRepo, settingsRepo);
      windowTracker.start();
    } else {
      console.log('[Activity] Window tracker already initialized.');
    }
  } else {
    console.log('[Activity] Window tracking is only supported on macOS (darwin). Skipping.');
  }

  // Initialize and start Google Docs Activity Subscriber
  if (!gdocsSubscriber) {
    console.log('[Activity] Initializing Google Docs subscriber...');
    gdocsSubscriber = new GDocsActivitySubscriber(activityRepo, settingsRepo, eventBus);
    gdocsSubscriber.start();
  } else {
    console.log('[Activity] Google Docs subscriber already initialized.');
  }

  if (process.platform === 'darwin' && !screenCapturer) {
    screenCapturer = new ScreenCapturer({
      activityRepo,
      settingsRepo,
      userDataDir: app.getPath('userData'),
    });
    // Always start the loop; captureOnce gates on screenCaptureEnabled +
    // pauseAllTracking each tick, so toggling the setting at runtime works.
    screenCapturer.start();
  }

  void runRetention({ activityRepo, settingsRepo, now: new Date() })
    .catch((err) => console.error('[Activity] retention failed:', err));
  if (!retentionIntervalId) {
    retentionIntervalId = setInterval(() => {
      void runRetention({ activityRepo, settingsRepo, now: new Date() })
        .catch((err) => console.error('[Activity] retention failed:', err));
    }, 6 * 60 * 60 * 1000);
  }
}

export function stopActivityMonitoring(): void {
  console.log('[Activity] Stopping active monitoring subsystems...');
  if (windowTracker) {
    windowTracker.stop();
    windowTracker = null;
  }
  if (gdocsSubscriber) {
    gdocsSubscriber.stop();
    gdocsSubscriber = null;
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
