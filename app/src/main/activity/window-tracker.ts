import { activeWindow, openWindows } from 'get-windows';
import { ActivityRepo } from '../store/repos/activity.js';
import { SettingsRepo } from '../store/repos/settings.js';

export class WindowTracker {
  private activityRepo: ActivityRepo;
  private settingsRepo: SettingsRepo;
  private intervalId: NodeJS.Timeout | null = null;
  private lastApp: string | null = null;
  private lastTitle: string | null = null;
  private lastLogTime = 0;
  private isChecking = false;

  constructor(activityRepo: ActivityRepo, settingsRepo: SettingsRepo) {
    this.activityRepo = activityRepo;
    this.settingsRepo = settingsRepo;
  }

  start(): void {
    if (process.platform !== 'darwin' && process.platform !== 'win32') {
      console.log(
        '[WindowTracker] Window tracking is only supported on macOS (darwin) and Windows (win32). Skipping start.',
      );
      return;
    }
    if (this.intervalId) {
      return;
    }
    this.intervalId = setInterval(() => {
      void this.checkActiveWindow();
    }, 10000);
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  async checkActiveWindow(): Promise<void> {
    if (process.platform !== 'darwin' && process.platform !== 'win32') {
      return;
    }
    if (this.isChecking) {
      return;
    }
    this.isChecking = true;

    try {
      const settings = this.settingsRepo.getAll();
      if (settings.pauseScheduling) {
        return;
      }

      const { app, title } = await this.getActiveWindowFromOS();

      const now = Date.now();
      const hasChanged = app !== this.lastApp || title !== this.lastTitle;
      const reachedTimeLimit = now - this.lastLogTime >= 60000;

      if (hasChanged || reachedTimeLimit) {
        this.lastApp = app;
        this.lastTitle = title;
        this.lastLogTime = now;
        this.activityRepo.log('window_focus', { app, title });
      }
    } catch (err) {
      console.error('Error tracking active window:', err);
    } finally {
      this.isChecking = false;
    }
  }

  private async getActiveWindowFromOS(): Promise<{ app: string; title: string }> {
    if (process.platform !== 'darwin' && process.platform !== 'win32') {
      throw new Error('Unsupported platform');
    }
    const result = await activeWindow();
    const app = result?.owner?.name || 'Unknown';
    const title = result?.title || 'Unknown';
    return { app, title };
  }
}

export async function listActiveWindows(): Promise<{ app: string; title: string }[]> {
  try {
    if (process.platform !== 'darwin' && process.platform !== 'win32') {
      return [];
    }
    const windows = await openWindows();
    return windows
      .filter((w) => {
        const app = w.owner?.name;
        const title = w.title;
        if (process.platform === 'darwin') {
          return app !== 'Finder' && title !== 'Unknown';
        } else {
          return app !== 'explorer' && title !== 'Unknown';
        }
      })
      .map((w) => ({
        app: w.owner?.name || 'Unknown',
        title: w.title || 'Unknown',
      }));
  } catch (err) {
    console.error('Error listing active windows:', err);
    return [];
  }
}
