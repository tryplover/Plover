import { desktopCapturer, type NativeImage } from 'electron';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { ActivityRepo, ActivityRow } from '../store/repos/activity.js';
import { SettingsRepo } from '../store/repos/settings.js';
import { getScreenRecordingStatus } from '../permissions/screen-recording.js';
import { authedFetch } from '../http/authed-fetch.js';
import { gate } from './shared/gate.js';

const VISION_UPLOAD_MAX_WIDTH = 1024;

export interface ScreenCapturerDeps {
  activityRepo: ActivityRepo;
  settingsRepo: SettingsRepo;
  userDataDir: string;
  now?: () => Date;
}

interface GrabbedScreen {
  png: Buffer;
  size: { width: number; height: number };
  thumbnail: NativeImage;
}

export class ScreenCapturer {
  private timeoutId: NodeJS.Timeout | null = null;
  private running = false;
  private now: () => Date;

  constructor(private deps: ScreenCapturerDeps) {
    this.now = deps.now ?? (() => new Date());
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.scheduleNext();
  }

  stop(): void {
    this.running = false;
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
  }

  async captureOnce(): Promise<string | null> {
    if (!this.canCapture()) return null;
    const grabbed = await this.grabPrimaryScreen();
    if (!grabbed) return null;
    const persisted = await this.persistScreenshot(grabbed.png, grabbed.size);
    await this.maybeRunInference(persisted.row, persisted.filePath, grabbed);
    return persisted.filePath;
  }

  private canCapture(): boolean {
    if (!gate(this.deps.settingsRepo, 'screenCaptureEnabled')) return false;
    if (getScreenRecordingStatus() !== 'granted') return false;
    return true;
  }

  private async grabPrimaryScreen(): Promise<GrabbedScreen | null> {
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width: 1920, height: 1080 },
    });
    const primary = sources[0];
    if (!primary) return null;
    return {
      png: primary.thumbnail.toPNG(),
      size: primary.thumbnail.getSize(),
      thumbnail: primary.thumbnail,
    };
  }

  private async persistScreenshot(
    png: Buffer,
    size: { width: number; height: number },
  ): Promise<{ filePath: string; row: ActivityRow }> {
    const now = this.now();
    const yyyy = String(now.getUTCFullYear());
    const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(now.getUTCDate()).padStart(2, '0');
    const dir = path.join(this.deps.userDataDir, 'screenshots', yyyy, mm, dd);
    await fs.mkdir(dir, { recursive: true });
    const filePath = path.join(dir, `${crypto.randomUUID()}.png`);
    await fs.writeFile(filePath, png);
    const row = this.deps.activityRepo.insert({
      kind: 'screenshot_captured',
      payload: { filePath, width: size.width, height: size.height },
      ts: now.toISOString(),
    });
    return { filePath, row };
  }

  private async maybeRunInference(
    row: ActivityRow,
    filePath: string,
    grabbed: GrabbedScreen,
  ): Promise<void> {
    if (!this.deps.settingsRepo.getAll().screenVisionInferenceEnabled) return;
    await this.runInference(row.id, filePath, grabbed).catch((err) =>
      console.error('[ScreenCapturer] infer failed:', err),
    );
  }

  private async runInference(
    screenshotId: number,
    filePath: string,
    grabbed: GrabbedScreen,
  ): Promise<void> {
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
    let uploadPng = grabbed.png;
    if (grabbed.size.width > VISION_UPLOAD_MAX_WIDTH) {
      const targetHeight = Math.round(
        grabbed.size.height * (VISION_UPLOAD_MAX_WIDTH / grabbed.size.width),
      );
      uploadPng = grabbed.thumbnail
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

  private scheduleNext(): void {
    if (!this.running) return;
    const intervalMs =
      Math.max(1, this.deps.settingsRepo.getAll().screenCaptureIntervalMinutes) * 60 * 1000;
    this.timeoutId = setTimeout(() => {
      void this.tick();
    }, intervalMs);
  }

  private async tick(): Promise<void> {
    try {
      await this.captureOnce();
    } catch (err) {
      console.error('[ScreenCapturer] capture failed:', err);
    }
    this.scheduleNext();
  }
}
