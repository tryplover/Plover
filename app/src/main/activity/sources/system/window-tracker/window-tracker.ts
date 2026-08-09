import { activeWindow } from 'get-windows';
import { execFile } from 'node:child_process';
import { ActivityRepo } from '@main/store/repos/activity.js';
import { SettingsRepo } from '@main/store/repos/settings.js';
import { getScreenRecordingStatus } from '@main/permissions/screen-recording.js';
import { gate } from '@main/activity/shared/gate.js';
import { BROWSER_BUNDLES, type WindowMeta } from './types.js';

export class WindowTracker {
  private intervalId: NodeJS.Timeout | null = null;
  private lastApp: string | null = null;
  private lastTitle: string | null = null;
  private lastLogTime = 0;
  private isChecking = false;

  constructor(private activityRepo: ActivityRepo, private settingsRepo: SettingsRepo) {}

  start(): void {
    if (process.platform !== 'darwin' && process.platform !== 'win32') return;
    if (this.intervalId) return;
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
    if (!this.canRun()) return;
    this.isChecking = true;
    try {
      const meta = await this.getActiveWindowFromOS();
      this.diffAndRecord(meta);
    } catch (err) {
      console.error('Error tracking active window:', err);
    } finally {
      this.isChecking = false;
    }
  }

  private async getActiveWindowFromOS(): Promise<WindowMeta> {
    const result = await activeWindow();
    const app = result?.owner?.name || 'Unknown';
    const title = result?.title || 'Unknown';
    const bundleId = (result?.owner as { bundleId?: string } | undefined)?.bundleId ?? undefined;
    let browserUrl: string | undefined;
    let browserTabTitle: string | undefined;
    if (process.platform === 'darwin' && bundleId && BROWSER_BUNDLES[bundleId]) {
      const captured = await this.tryReadBrowserTab(BROWSER_BUNDLES[bundleId]);
      if (captured) {
        browserUrl = captured.url;
        browserTabTitle = captured.title;
      }
    }
    return { app, title, bundleId, browserUrl, browserTabTitle };
  }

  private tryReadBrowserTab(appName: string): Promise<{ url: string; title: string } | null> {
    const script =
      appName === 'Firefox'
        ? 'tell application "Firefox" to get URL of active tab of front window'
        : `tell application "${appName}" to (get URL of active tab of front window) & linefeed & (get title of active tab of front window)`;
    return new Promise((resolve) => {
      execFile('osascript', ['-e', script], { timeout: 1000 }, (err, stdout) => {
        if (err) {
          resolve(null);
          return;
        }
        const text = stdout.toString().trim();
        if (!text) {
          resolve(null);
          return;
        }
        const [url, ...rest] = text.split('\n');
        resolve(url ? { url, title: rest.join(' ').trim() || appName } : null);
      });
    });
  }

  private canRun(): boolean {
    if (process.platform !== 'darwin' && process.platform !== 'win32') return false;
    if (process.platform === 'darwin' && getScreenRecordingStatus() !== 'granted') return false;
    if (this.isChecking) return false;
    if (!gate(this.settingsRepo, 'windowTrackingEnabled')) return false;
    if (this.settingsRepo.getAll().pauseScheduling) return false;
    return true;
  }

  private diffAndRecord(meta: WindowMeta): void {
    const now = Date.now();
    const hasChanged = meta.app !== this.lastApp || meta.title !== this.lastTitle;
    const reachedTimeLimit = now - this.lastLogTime >= 60000;
    if (!hasChanged && !reachedTimeLimit) return;
    this.lastApp = meta.app;
    this.lastTitle = meta.title;
    this.lastLogTime = now;
    this.activityRepo.log('window_focus', this.buildPayload(meta));
  }

  private buildPayload(meta: WindowMeta): Record<string, unknown> {
    const payload: Record<string, unknown> = { app: meta.app, title: meta.title };
    if (meta.bundleId) payload.bundleId = meta.bundleId;
    if (meta.browserUrl) payload.browserUrl = meta.browserUrl;
    if (meta.browserTabTitle) payload.browserTabTitle = meta.browserTabTitle;
    return payload;
  }
}
