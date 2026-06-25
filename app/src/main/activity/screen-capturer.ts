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
      const intervalMs = Math.max(1, this.deps.settingsRepo.getAll().screenCaptureIntervalMinutes) * 60 * 1000;
      this.timeoutId = setTimeout(() => { void tick(); }, intervalMs);
    };
    const intervalMs = Math.max(1, this.deps.settingsRepo.getAll().screenCaptureIntervalMinutes) * 60 * 1000;
    this.timeoutId = setTimeout(() => { void tick(); }, intervalMs);
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
      await this.runInference(captureRow.id, filePath, png).catch((err) => console.error('[ScreenCapturer] infer failed:', err));
    }
    return filePath;
  }

  private async runInference(screenshotId: number, filePath: string, png: Buffer): Promise<void> {
    const backendUrl = (process.env.PLOVER_BACKEND_URL ?? 'http://localhost:3000').trim();
    const authToken = process.env.PLOVER_AUTH_TOKEN;
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (authToken) headers['X-Plover-Auth-Token'] = authToken;
    const res = await fetch(`${backendUrl}/api/infer-screen`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ screenshotBase64: png.toString('base64') }),
    });
    if (!res.ok) return;
    const body = await res.json() as { summary?: string; activeApp?: string; currentTask?: string | null; confidence?: number };
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
