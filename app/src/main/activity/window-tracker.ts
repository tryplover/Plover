import { execFile } from 'node:child_process';
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
    if (process.platform !== 'darwin') {
      console.log(
        '[WindowTracker] Window tracking is only supported on macOS (darwin). Skipping start.',
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
    if (process.platform !== 'darwin') {
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

  private getActiveWindowFromOS(): Promise<{ app: string; title: string }> {
    return new Promise((resolve, reject) => {
      const appleScript = `tell application "System Events"
    set frontmostProcess to first process whose frontmost is true
    set productName to name of frontmostProcess
    set titleOfWindow to "Unknown"
    try
        tell process productName
            set titleOfWindow to name of window 1
        end tell
    end try
    return productName & "|||" & titleOfWindow
end tell`;

      execFile('osascript', ['-e', appleScript], (error, stdout) => {
        if (error) {
          reject(error);
          return;
        }

        const output = stdout.trim();
        const parts = output.split('|||');
        const app = parts[0]?.trim() || 'Unknown';
        const title = parts[1]?.trim() || 'Unknown';

        resolve({ app, title });
      });
    });
  }
}
