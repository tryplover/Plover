import { desktopCapturer } from 'electron';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { ActivityRepo } from '../store/repos/activity.js';
import { SettingsRepo } from '../store/repos/settings.js';
import { getScreenRecordingStatus } from '../permissions/screen-recording.js';

export interface ScreenCapturerDeps {
  activityRepo: ActivityRepo;
  settingsRepo: SettingsRepo;
  userDataDir: string;
  now?: () => Date;
}

export class ScreenCapturer {
  private deps: ScreenCapturerDeps;
  private intervalId: NodeJS.Timeout | null = null;
  private now: () => Date;

  constructor(deps: ScreenCapturerDeps) {
    this.deps = deps;
    this.now = deps.now ?? (() => new Date());
  }

  start(): void {
    if (this.intervalId) return;
    const tick = async (): Promise<void> => {
      try {
        await this.captureOnce();
      } catch (err) {
        console.error('[ScreenCapturer] capture failed:', err);
      }
    };
    const intervalMs = Math.max(1, this.deps.settingsRepo.getAll().screenCaptureIntervalMinutes) * 60 * 1000;
    this.intervalId = setInterval(() => { void tick(); }, intervalMs);
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  async captureOnce(): Promise<string | null> {
    const settings = this.deps.settingsRepo.getAll();
    if (!settings.screenCaptureEnabled) return null;
    if (settings.pauseAllTracking) return null;
    if (getScreenRecordingStatus() !== 'granted') return null;

    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width: 1920, height: 1080 },
    });
    const primary = sources[0];
    if (!primary) return null;
    const png = primary.thumbnail.toPNG();
    const size = primary.thumbnail.getSize();
    const now = this.now();
    const yyyy = String(now.getUTCFullYear());
    const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(now.getUTCDate()).padStart(2, '0');
    const dir = path.join(this.deps.userDataDir, 'screenshots', yyyy, mm, dd);
    await fs.mkdir(dir, { recursive: true });
    const filename = `${crypto.randomUUID()}.png`;
    const filePath = path.join(dir, filename);
    await fs.writeFile(filePath, png);
    this.deps.activityRepo.log('screenshot_captured', {
      filePath,
      width: size.width,
      height: size.height,
    }, now.toISOString());
    return filePath;
  }
}
