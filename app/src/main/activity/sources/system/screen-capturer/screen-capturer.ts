import { desktopCapturer } from 'electron';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { ActivityRow } from '@main/store/repos/activity.js';
import { getScreenRecordingStatus } from '@main/permissions/screen-recording.js';
import { authedFetch } from '@main/http/authed-fetch.js';
import { gate } from '@main/activity/shared/gate.js';
import { VISION_UPLOAD_MAX_WIDTH, type ScreenCapturerDeps, type GrabbedScreen } from './types.js';

const MIN_CAPTURE_INTERVAL_MINUTES = 1;

function windowFocusKey(row: ActivityRow | undefined): string | null {
  if (!row || row.kind !== 'window_focus') return null;
  return `${row.payload.app}::${row.payload.title}`;
}

export class ScreenCapturer {
  private timeoutId: NodeJS.Timeout | null = null;
  private running = false;
  private now: () => Date;
  // Pacing state, intentionally separate from settings.lastVisionInferenceWindowKey:
  // that field answers "was vision already run for this window," this answers
  // "has the window changed since the last tick," and conflating them would make
  // both harder to reason about.
  private currentIntervalMinutes: number | null = null;
  private lastSeenWindowKey: string | null = null;

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

    // Pass the most recent window_focus payload to the backend so Gemini Vision
    // has the active app/title/URL as context, and use it to drive both the
    // capture cadence and the vision-call gating below.
    const lastFocus = this.deps.activityRepo.list({ kind: 'window_focus', limit: 1 })[0];
    const windowKey = windowFocusKey(lastFocus);
    this.updateCadence(windowKey);

    await this.maybeRunInference(persisted.row, persisted.filePath, grabbed, lastFocus, windowKey);
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

  // Adapt the capture pace: check often right after a genuine window change,
  // back off (up to the screenCaptureIntervalMinutes ceiling) during idle
  // stretches. Runs regardless of vision being enabled, since it also cuts
  // local capture/disk overhead, not just the paid vision call.
  private updateCadence(windowKey: string | null): void {
    if (windowKey !== null && windowKey === this.lastSeenWindowKey) {
      const previous = this.currentIntervalMinutes ?? MIN_CAPTURE_INTERVAL_MINUTES;
      const ceiling = this.deps.settingsRepo.getAll().screenCaptureIntervalMinutes;
      this.currentIntervalMinutes = Math.min(ceiling, previous * 2);
    } else {
      this.currentIntervalMinutes = MIN_CAPTURE_INTERVAL_MINUTES;
    }
    this.lastSeenWindowKey = windowKey;
  }

  private async maybeRunInference(
    row: ActivityRow,
    filePath: string,
    grabbed: GrabbedScreen,
    lastFocus: ActivityRow | undefined,
    windowKey: string | null,
  ): Promise<void> {
    if (!this.deps.settingsRepo.getAll().screenVisionInferenceEnabled) return;
    // Skip the paid vision call when the active window hasn't changed since the
    // last successful call — the expensive part of this loop is per-call, and a
    // static window rarely warrants re-analysis. Unknown window context (no
    // window_focus row yet, or an unsupported platform) always calls through,
    // since we can't prove nothing changed.
    const unchanged =
      windowKey !== null &&
      windowKey === this.deps.settingsRepo.getAll().lastVisionInferenceWindowKey;
    if (unchanged) return;
    await this.runInference(row.id, filePath, grabbed, lastFocus, windowKey).catch((err) =>
      console.error('[ScreenCapturer] infer failed:', err),
    );
  }

  private async runInference(
    screenshotId: number,
    filePath: string,
    grabbed: GrabbedScreen,
    lastFocus: ActivityRow | undefined,
    windowKey: string | null,
  ): Promise<void> {
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
    // Only remember this window as "already analyzed" once we've successfully
    // gotten a result for it — a failed call shouldn't cause a future skip.
    if (windowKey !== null) {
      this.deps.settingsRepo.update({ lastVisionInferenceWindowKey: windowKey });
    }
  }

  private scheduleNext(): void {
    if (!this.running) return;
    // Recursive setTimeout (re-scheduled by tick) instead of setInterval so
    // captures never overlap and the interval is re-read each tick. The callback
    // returns tick()'s promise rather than voiding it so fake-timer tests can
    // await each tick's async work (see the plover-testing skill).
    const intervalMs = (this.currentIntervalMinutes ?? MIN_CAPTURE_INTERVAL_MINUTES) * 60 * 1000;
    this.timeoutId = setTimeout(() => this.tick(), intervalMs);
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
