import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const { getSources, getMediaAccessStatus } = vi.hoisted(() => ({
  getSources: vi.fn(),
  getMediaAccessStatus: vi.fn(),
}));

vi.mock('electron', () => ({
  desktopCapturer: { getSources },
  systemPreferences: { getMediaAccessStatus },
  app: { isPackaged: false },
}));

const mockGetPloverToken = vi.hoisted(() => vi.fn().mockResolvedValue('test-token-xyz'));
vi.mock('../../src/main/auth/plover-token.js', () => ({
  getPloverToken: mockGetPloverToken,
  setPloverToken: vi.fn(),
  clearPloverToken: vi.fn(),
}));

import { ActivityRepo } from '../../src/main/store/repos/activity.js';
import { SettingsRepo } from '../../src/main/store/repos/settings.js';
import { runMigrations } from '../../src/main/store/db.js';
import { ScreenCapturer } from '../../src/main/activity/screen-capturer.js';

describe('ScreenCapturer', () => {
  let userDataDir: string;
  let db: Database.Database;
  let activityRepo: ActivityRepo;
  let settingsRepo: SettingsRepo;
  let capturer: ScreenCapturer;
  const realPlatform = process.platform;

  beforeEach(async () => {
    Object.defineProperty(process, 'platform', { value: 'darwin' });
    userDataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'plover-cap-'));
    db = new Database(':memory:');
    runMigrations(db);
    activityRepo = new ActivityRepo(db);
    settingsRepo = new SettingsRepo(db);
    capturer = new ScreenCapturer({
      activityRepo,
      settingsRepo,
      userDataDir,
      now: () => new Date('2026-06-25T12:34:56.000Z'),
    });
    getSources.mockReset();
    getMediaAccessStatus.mockReset();
    getMediaAccessStatus.mockReturnValue('granted');
  });

  afterEach(async () => {
    Object.defineProperty(process, 'platform', { value: realPlatform });
    await fs.rm(userDataDir, { recursive: true, force: true });
  });

  it('skips when screenCaptureEnabled is false', async () => {
    const result = await capturer.captureOnce();
    expect(result).toBeNull();
    expect(activityRepo.list()).toHaveLength(0);
  });

  it('skips when pauseAllTracking is true even if enabled', async () => {
    settingsRepo.update({ screenCaptureEnabled: true, pauseAllTracking: true });
    const result = await capturer.captureOnce();
    expect(result).toBeNull();
  });

  it('skips when permission is not granted', async () => {
    settingsRepo.update({ screenCaptureEnabled: true });
    getMediaAccessStatus.mockReturnValue('denied');
    const result = await capturer.captureOnce();
    expect(result).toBeNull();
  });

  it('captures, writes PNG, and logs payload on success', async () => {
    settingsRepo.update({ screenCaptureEnabled: true });
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
    getSources.mockResolvedValueOnce([
      {
        name: 'Entire Screen',
        thumbnail: { toPNG: () => png, getSize: () => ({ width: 1440, height: 900 }) },
      },
    ]);
    const filePath = await capturer.captureOnce();
    expect(filePath).toBeTruthy();
    if (!filePath) return;
    expect(filePath.replace(/\\/g, '/')).toMatch(/\/screenshots\/2026\/06\/25\/[^/]+\.png$/);
    const onDisk = await fs.readFile(filePath);
    expect(onDisk.equals(png)).toBe(true);
    const rows = activityRepo.list();
    expect(rows).toHaveLength(1);
    const row = rows[0];
    expect(row?.kind).toBe('screenshot_captured');
    expect(row?.payload).toMatchObject({ filePath, width: 1440, height: 900 });
  });

  it('calls infer-screen and logs screenshot_inferred when vision is enabled', async () => {
    settingsRepo.update({ screenCaptureEnabled: true, screenVisionInferenceEnabled: true });
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
    getSources.mockResolvedValueOnce([
      {
        name: 'Entire Screen',
        thumbnail: { toPNG: () => png, getSize: () => ({ width: 100, height: 100 }) },
      },
    ]);
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        summary: 'In Slack',
        activeApp: 'Slack',
        currentTask: null,
        confidence: 0.6,
      }),
    });
    vi.stubGlobal('fetch', fetchMock);
    await capturer.captureOnce();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const kinds = activityRepo.list().map((r) => r.kind);
    expect(kinds).toContain('screenshot_inferred');
    vi.unstubAllGlobals();
  });

  it('forwards windowContext from most recent window_focus row in fetch body', async () => {
    settingsRepo.update({ screenCaptureEnabled: true, screenVisionInferenceEnabled: true });
    activityRepo.log('window_focus', {
      app: 'Slack',
      title: 'General',
      browserUrl: 'https://app.slack.com',
    });
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
    getSources.mockResolvedValueOnce([
      {
        name: 'Entire Screen',
        thumbnail: { toPNG: () => png, getSize: () => ({ width: 100, height: 100 }) },
      },
    ]);
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        summary: 'In Slack',
        activeApp: 'Slack',
        currentTask: null,
        confidence: 0.8,
      }),
    });
    vi.stubGlobal('fetch', fetchMock);
    await capturer.captureOnce();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, callOptions] = fetchMock.mock.calls[0] as [string, { body: string }];
    const body = JSON.parse(callOptions.body) as {
      screenshotBase64: string;
      windowContext?: { app: string; title: string; browserUrl?: string };
    };
    expect(body.windowContext).toMatchObject({
      app: 'Slack',
      title: 'General',
      browserUrl: 'https://app.slack.com',
    });
    vi.unstubAllGlobals();
  });

  it('omits windowContext from fetch body when no window_focus row exists', async () => {
    settingsRepo.update({ screenCaptureEnabled: true, screenVisionInferenceEnabled: true });
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
    getSources.mockResolvedValueOnce([
      {
        name: 'Entire Screen',
        thumbnail: { toPNG: () => png, getSize: () => ({ width: 100, height: 100 }) },
      },
    ]);
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        summary: 'Desktop',
        activeApp: 'Finder',
        currentTask: null,
        confidence: 0.7,
      }),
    });
    vi.stubGlobal('fetch', fetchMock);
    await capturer.captureOnce();
    const [, callOptions] = fetchMock.mock.calls[0] as [string, { body: string }];
    const body = JSON.parse(callOptions.body) as {
      screenshotBase64: string;
      windowContext?: unknown;
    };
    expect(body.windowContext).toBeUndefined();
    vi.unstubAllGlobals();
  });

  describe('window-change gating for infer-screen calls', () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47]);

    beforeEach(() => {
      settingsRepo.update({ screenCaptureEnabled: true, screenVisionInferenceEnabled: true });
      getSources.mockResolvedValue([
        {
          name: 'Entire Screen',
          thumbnail: { toPNG: () => png, getSize: () => ({ width: 100, height: 100 }) },
        },
      ]);
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('skips the vision call on a second capture when the active window is unchanged', async () => {
      activityRepo.log('window_focus', { app: 'VS Code', title: 'auth-service.ts' });
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          summary: 'Coding',
          activeApp: 'VS Code',
          currentTask: null,
          confidence: 0.7,
        }),
      });
      vi.stubGlobal('fetch', fetchMock);

      await capturer.captureOnce();
      expect(fetchMock).toHaveBeenCalledTimes(1);

      await capturer.captureOnce();
      expect(fetchMock).toHaveBeenCalledTimes(1);

      // The screenshot itself is still captured/logged even when vision is skipped.
      const captureCount = activityRepo.list({ kind: 'screenshot_captured' }).length;
      expect(captureCount).toBe(2);
    });

    it('calls the vision endpoint again once the active window changes', async () => {
      activityRepo.log('window_focus', { app: 'VS Code', title: 'auth-service.ts' });
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          summary: 'Coding',
          activeApp: 'VS Code',
          currentTask: null,
          confidence: 0.7,
        }),
      });
      vi.stubGlobal('fetch', fetchMock);

      await capturer.captureOnce();
      expect(fetchMock).toHaveBeenCalledTimes(1);

      activityRepo.log('window_focus', { app: 'Slack', title: 'General' });
      await capturer.captureOnce();
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('never skips when there is no window_focus row to compare against', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          summary: 'Desktop',
          activeApp: 'Finder',
          currentTask: null,
          confidence: 0.5,
        }),
      });
      vi.stubGlobal('fetch', fetchMock);

      await capturer.captureOnce();
      await capturer.captureOnce();
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('does not remember the window as analyzed when the vision call fails, so the next capture retries', async () => {
      activityRepo.log('window_focus', { app: 'VS Code', title: 'auth-service.ts' });
      const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 500 });
      vi.stubGlobal('fetch', fetchMock);

      await capturer.captureOnce();
      await capturer.captureOnce();
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(settingsRepo.getAll().lastVisionInferenceWindowKey).toBeNull();
    });
  });

  describe('vision upload downscaling', () => {
    const fullResPng = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
    const resizedPng = Buffer.from([0x01, 0x02, 0x03, 0x04]);

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('resizes the upload to VISION_UPLOAD_MAX_WIDTH when the capture is wider, but writes the full-res PNG to disk', async () => {
      settingsRepo.update({ screenCaptureEnabled: true, screenVisionInferenceEnabled: true });
      const resize = vi.fn().mockReturnValue({ toPNG: () => resizedPng });
      getSources.mockResolvedValueOnce([
        {
          name: 'Entire Screen',
          thumbnail: {
            toPNG: () => fullResPng,
            getSize: () => ({ width: 1920, height: 1080 }),
            resize,
          },
        },
      ]);
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          summary: 'Desktop',
          activeApp: 'Finder',
          currentTask: null,
          confidence: 0.5,
        }),
      });
      vi.stubGlobal('fetch', fetchMock);

      const filePath = await capturer.captureOnce();
      expect(resize).toHaveBeenCalledWith({ width: 1024, height: 576 });

      const [, callOptions] = fetchMock.mock.calls[0] as [string, { body: string }];
      const body = JSON.parse(callOptions.body) as { screenshotBase64: string };
      expect(Buffer.from(body.screenshotBase64, 'base64').equals(resizedPng)).toBe(true);

      expect(filePath).toBeTruthy();
      if (!filePath) return;
      const onDisk = await fs.readFile(filePath);
      expect(onDisk.equals(fullResPng)).toBe(true);
    });

    it('skips resizing when the capture is already at or under VISION_UPLOAD_MAX_WIDTH', async () => {
      settingsRepo.update({ screenCaptureEnabled: true, screenVisionInferenceEnabled: true });
      const resize = vi.fn().mockReturnValue({ toPNG: () => resizedPng });
      getSources.mockResolvedValueOnce([
        {
          name: 'Entire Screen',
          thumbnail: {
            toPNG: () => fullResPng,
            getSize: () => ({ width: 800, height: 600 }),
            resize,
          },
        },
      ]);
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          summary: 'Desktop',
          activeApp: 'Finder',
          currentTask: null,
          confidence: 0.5,
        }),
      });
      vi.stubGlobal('fetch', fetchMock);

      await capturer.captureOnce();
      expect(resize).not.toHaveBeenCalled();

      const [, callOptions] = fetchMock.mock.calls[0] as [string, { body: string }];
      const body = JSON.parse(callOptions.body) as { screenshotBase64: string };
      expect(Buffer.from(body.screenshotBase64, 'base64').equals(fullResPng)).toBe(true);
    });
  });

  describe('adaptive capture interval', () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47]);

    beforeEach(() => {
      // Real disk I/O resolves via the real event loop, not a plain microtask, so
      // vi.advanceTimersByTimeAsync won't wait for it before deciding a tick is
      // "done" — stub it out so the capture chain resolves purely via microtasks
      // that the fake-timer advance loop can actually observe.
      vi.spyOn(fs, 'mkdir').mockResolvedValue(undefined);
      vi.spyOn(fs, 'writeFile').mockResolvedValue(undefined);
      vi.useFakeTimers();
      settingsRepo.update({ screenCaptureEnabled: true, screenCaptureIntervalMinutes: 5 });
      getSources.mockResolvedValue([
        {
          name: 'Entire Screen',
          thumbnail: { toPNG: () => png, getSize: () => ({ width: 100, height: 100 }) },
        },
      ]);
    });

    afterEach(() => {
      capturer.stop();
      vi.useRealTimers();
      vi.restoreAllMocks();
    });

    it('grows the interval each tick (1 -> 2 -> 4 -> 5) while the window is unchanged, capped at the ceiling', async () => {
      activityRepo.log('window_focus', { app: 'VS Code', title: 'file.ts' });
      capturer.start();

      // tick 1 fires at the initial 1-minute schedule; the first observation always
      // resets pacing to MIN since there's no prior lastSeenWindowKey to compare against.
      await vi.advanceTimersByTimeAsync(60_000);
      expect(getSources).toHaveBeenCalledTimes(1);

      // tick 2: still 1 minute, since tick 1 itself only just established lastSeenWindowKey.
      await vi.advanceTimersByTimeAsync(60_000);
      expect(getSources).toHaveBeenCalledTimes(2);

      // tick 3: window was unchanged during tick 2, so the interval doubled to 2 minutes.
      await vi.advanceTimersByTimeAsync(119_000);
      expect(getSources).toHaveBeenCalledTimes(2);
      await vi.advanceTimersByTimeAsync(1_000);
      expect(getSources).toHaveBeenCalledTimes(3);

      // tick 4: doubled again to 4 minutes.
      await vi.advanceTimersByTimeAsync(239_000);
      expect(getSources).toHaveBeenCalledTimes(3);
      await vi.advanceTimersByTimeAsync(1_000);
      expect(getSources).toHaveBeenCalledTimes(4);

      // tick 5: would double to 8 minutes, but is capped at the 5-minute ceiling.
      await vi.advanceTimersByTimeAsync(299_000);
      expect(getSources).toHaveBeenCalledTimes(4);
      await vi.advanceTimersByTimeAsync(1_000);
      expect(getSources).toHaveBeenCalledTimes(5);

      // tick 6: stays at the ceiling, does not exceed 5 minutes.
      await vi.advanceTimersByTimeAsync(299_000);
      expect(getSources).toHaveBeenCalledTimes(5);
      await vi.advanceTimersByTimeAsync(1_000);
      expect(getSources).toHaveBeenCalledTimes(6);
    });

    it('resets to the minimum interval when the active window changes mid-backoff', async () => {
      activityRepo.log('window_focus', { app: 'VS Code', title: 'file.ts' });
      capturer.start();

      await vi.advanceTimersByTimeAsync(60_000); // tick 1, fires at MIN
      await vi.advanceTimersByTimeAsync(60_000); // tick 2, fires at MIN, schedules next at 2x
      expect(getSources).toHaveBeenCalledTimes(2);

      activityRepo.log('window_focus', { app: 'Slack', title: 'General' });

      // tick 3 was already scheduled for the 2-minute backoff mark before the window
      // changed; it fires on schedule and is the one that observes the new window.
      await vi.advanceTimersByTimeAsync(120_000);
      expect(getSources).toHaveBeenCalledTimes(3);

      // Because tick 3 saw a changed window, the next tick is scheduled at MIN (1 minute),
      // not a continuation of the backoff (which would double to 4 minutes).
      await vi.advanceTimersByTimeAsync(60_000);
      expect(getSources).toHaveBeenCalledTimes(4);
    });

    it('paces captures even when vision inference is disabled', async () => {
      expect(settingsRepo.getAll().screenVisionInferenceEnabled).toBe(false);
      activityRepo.log('window_focus', { app: 'VS Code', title: 'file.ts' });
      capturer.start();

      await vi.advanceTimersByTimeAsync(60_000); // tick 1
      await vi.advanceTimersByTimeAsync(60_000); // tick 2, schedules next at 2 minutes

      await vi.advanceTimersByTimeAsync(119_000);
      expect(getSources).toHaveBeenCalledTimes(2);
      await vi.advanceTimersByTimeAsync(1_000);
      expect(getSources).toHaveBeenCalledTimes(3);
    });
  });
});
