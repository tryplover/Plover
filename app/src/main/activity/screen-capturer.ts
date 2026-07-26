import { desktopCapturer, type NativeImage } from 'electron';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { ActivityRepo } from '../store/repos/activity.js';
import { SettingsRepo } from '../store/repos/settings.js';
import { getScreenRecordingStatus } from '../permissions/screen-recording.js';
import { authedFetch } from '../http/authed-fetch.js';

const VISION_UPLOAD_MAX_WIDTH = 1024;

export interface ScreenCapturerDeps {
  activityRepo: ActivityRepo;
  settingsRepo: SettingsRepo;
  userDataDir: string;
  now?: () => Date;
}

export class ScreenCapturer {
  private deps: ScreenCapturerDeps;
  private timeoutId: NodeJS.Timeout | null = null;
  private running = false;
  private now: () => Date;

  constructor(deps: ScreenCapturerDeps) {
    this.deps = deps;
    this.now = deps.now ?? (() => new Date());
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    // Recursive setTimeout instead of setInterval so captures never overlap
    // and the interval setting is re-read each tick from settings.
    const tick = async (): Promise<void> => {
      try {
        await this.captureOnce();
      } catch (err) {
        console.error('[ScreenCapturer] capture failed:', err);
      }
      if (!this.running) return;
      const intervalMs =
        Math.max(1, this.deps.settingsRepo.getAll().screenCaptureIntervalMinutes) * 60 * 1000;
      this.timeoutId = setTimeout(() => {
        void tick();
      }, intervalMs);
    };
    const intervalMs =
      Math.max(1, this.deps.settingsRepo.getAll().screenCaptureIntervalMinutes) * 60 * 1000;
    this.timeoutId = setTimeout(() => {
      void tick();
    }, intervalMs);
  }

  stop(): void {
    this.running = false;
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
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
    const captureRow = this.deps.activityRepo.insert({
      kind: 'screenshot_captured',
      payload: { filePath, width: size.width, height: size.height },
      ts: now.toISOString(),
    });
    if (settings.screenVisionInferenceEnabled) {
      await this.runInference(captureRow.id, filePath, png, primary.thumbnail, size).catch((err) =>
        console.error('[ScreenCapturer] infer failed:', err),
      );
    }
    return filePath;
  }

  private async runInference(
    screenshotId: number,
    filePath: string,
    png: Buffer,
    thumbnail: NativeImage,
    size: { width: number; height: number },
  ): Promise<void> {
    // Pass the most recent window_focus payload to the backend so Gemini Vision
    // has the active app/title/URL as context instead of falling back to "no context".
    const lastFocus = this.deps.activityRepo.list({ kind: 'window_focus', limit: 1 })[0];
    const windowContext =
      lastFocus?.kind === 'window_focus'
        ? {
            app: lastFocus.payload.app,
            title: lastFocus.payload.title,
            browserUrl: lastFocus.payload.browserUrl,
          }
        : undefined;

    // The vision call only needs a coarse read of the screen, so shrink the
    // upload to cut per-call cost. Both dimensions are computed explicitly
    // because NativeImage.resize does not guarantee proportional scaling when
    // only one dimension is supplied.
    let uploadPng = png;
    if (size.width > VISION_UPLOAD_MAX_WIDTH) {
      const targetHeight = Math.round(size.height * (VISION_UPLOAD_MAX_WIDTH / size.width));
      uploadPng = thumbnail
        .resize({ width: VISION_UPLOAD_MAX_WIDTH, height: targetHeight })
        .toPNG();
    }

    const res = await authedFetch('/api/infer-screen', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ screenshotBase64: uploadPng.toString('base64'), windowContext }),
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return;
    const body = (await res.json()) as {
      summary?: string;
      activeApp?: string;
      currentTask?: string | null;
      confidence?: number;
    };
    this.deps.activityRepo.log('screenshot_inferred', {
      screenshotId,
      filePath,
      summary: body.summary ?? '',
      activeApp: body.activeApp ?? '',
      currentTask: body.currentTask ?? null,
      confidence: Number(body.confidence ?? 0),
    });
  }
}
