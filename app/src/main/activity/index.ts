import { app } from 'electron';
import { WindowTracker } from './window-tracker.js';
import { GDocsPoller } from './gdocs-poller.js';
import { ScreenCapturer } from './screen-capturer.js';
import { runRetention } from './retention.js';
import { settingsRepo, activityRepo } from '../store/index.js';
import { googleAuth } from '../ipc.js';

let windowTracker: WindowTracker | null = null;
let gdocsPoller: GDocsPoller | null = null;
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

  // Initialize and start Google Docs Poller (ticks every 10 minutes)
  if (!gdocsPoller) {
    console.log('[Activity] Initializing Google Docs poller...');
    gdocsPoller = new GDocsPoller(googleAuth, activityRepo, settingsRepo);
    gdocsPoller.start();
  } else {
    console.log('[Activity] Google Docs poller already initialized.');
  }

  if (process.platform === 'darwin' && !screenCapturer) {
    screenCapturer = new ScreenCapturer({
      activityRepo,
      settingsRepo,
      userDataDir: app.getPath('userData'),
    });
    if (settingsRepo.getAll().screenCaptureEnabled) screenCapturer.start();
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
  if (gdocsPoller) {
    gdocsPoller.stop();
    gdocsPoller = null;
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

export function getScreenCapturer(): ScreenCapturer | null { return screenCapturer; }
