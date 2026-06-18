import { WindowTracker } from './window-tracker.js';
import { settingsRepo, activityRepo } from '../store/index.js';

let windowTracker: WindowTracker | null = null;

export function initActivityMonitoring(): void {
  if (process.platform !== 'darwin') {
    console.log(
      '[Activity] Window tracking is only supported on macOS (darwin). Skipping initialization.',
    );
    return;
  }
  if (windowTracker) {
    console.log('[Activity] Window tracker already initialized.');
    return;
  }
  console.log('[Activity] Initializing active window tracker...');

  // Initialize and start Window Tracker (ticks every 10 seconds)
  windowTracker = new WindowTracker(activityRepo, settingsRepo);
  windowTracker.start();
}

export function stopActivityMonitoring(): void {
  console.log('[Activity] Stopping active monitoring subsystems...');
  if (windowTracker) {
    windowTracker.stop();
    windowTracker = null;
  }
}
