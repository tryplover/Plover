import { WindowTracker } from './window-tracker.js';
import { GDocsPoller } from './gdocs-poller.js';
import { settingsRepo, activityRepo } from '../store/index.js';
import { googleAuth } from '../ipc.js';

let windowTracker: WindowTracker | null = null;
let gdocsPoller: GDocsPoller | null = null;

export function initActivityMonitoring(): void {
  console.log('[Activity] Initializing active window tracker and Google Docs poller...');

  // Initialize and start Window Tracker (ticks every 10 seconds)
  windowTracker = new WindowTracker(activityRepo, settingsRepo);
  windowTracker.start();

  // Initialize and start Google Docs Poller (ticks every 10 minutes)
  gdocsPoller = new GDocsPoller(googleAuth, activityRepo, settingsRepo);
  gdocsPoller.start();
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
}
