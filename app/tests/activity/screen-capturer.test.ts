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
    capturer = new ScreenCapturer({ activityRepo, settingsRepo, userDataDir, now: () => new Date('2026-06-25T12:34:56.000Z') });
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
    getSources.mockResolvedValueOnce([{
      name: 'Entire Screen',
      thumbnail: { toPNG: () => png, getSize: () => ({ width: 1440, height: 900 }) },
    }]);
    const filePath = await capturer.captureOnce();
    expect(filePath).toBeTruthy();
    if (!filePath) return;
    expect(filePath).toMatch(/\/screenshots\/2026\/06\/25\/[^/]+\.png$/);
    const onDisk = await fs.readFile(filePath);
    expect(onDisk.equals(png)).toBe(true);
    const rows = activityRepo.list();
    expect(rows).toHaveLength(1);
    const row = rows[0];
    expect(row?.kind).toBe('screenshot_captured');
    expect(row?.payload).toMatchObject({ filePath, width: 1440, height: 900 });
  });
});
