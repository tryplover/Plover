import { describe, it, expect, beforeEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import { ActivityRepo } from '@main/store/repos/activity.js';
import { SettingsRepo } from '@main/store/repos/settings.js';
import { runMigrations } from '@main/store/db.js';
import { runRetention } from '@main/activity/processing/retention/index.js';
import { promises as fs } from 'node:fs';

describe('runRetention', () => {
  let db: Database.Database;
  let activityRepo: ActivityRepo;
  let settingsRepo: SettingsRepo;

  beforeEach(() => {
    db = new Database(':memory:');
    runMigrations(db);
    activityRepo = new ActivityRepo(db);
    settingsRepo = new SettingsRepo(db);
  });

  it('does nothing when retention is 0', async () => {
    settingsRepo.update({ activityRetentionDays: 0 });
    activityRepo.insert({ kind: 'x', payload: {}, ts: '2020-01-01T00:00:00.000Z' });
    const r = await runRetention({ activityRepo, settingsRepo, now: new Date('2026-06-25T00:00:00.000Z') });
    expect(r.deleted).toBe(0);
    expect(r.cutoff).toBeNull();
    expect(activityRepo.list()).toHaveLength(1);
  });

  it('deletes rows older than the cutoff and unlinks orphan screenshot files', async () => {
    const unlinkSpy = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(fs, 'unlink').mockImplementation(unlinkSpy);
    settingsRepo.update({ activityRetentionDays: 30 });
    activityRepo.insert({
      kind: 'screenshot_captured',
      payload: { filePath: '/tmp/plover-screens/old.png', width: 1, height: 1 },
      ts: '2026-01-01T00:00:00.000Z',
    });
    activityRepo.insert({ kind: 'window_focus', payload: { app: 'X', title: 'Y' }, ts: '2026-06-20T00:00:00.000Z' });
    const r = await runRetention({ activityRepo, settingsRepo, now: new Date('2026-06-25T00:00:00.000Z') });
    expect(r.deleted).toBe(1);
    expect(r.cutoff).toBe('2026-05-26T00:00:00.000Z');
    expect(unlinkSpy).toHaveBeenCalledWith('/tmp/plover-screens/old.png');
  });

  it('paginates through >500 screenshot rows to unlink all files', async () => {
    const unlinkSpy = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(fs, 'unlink').mockImplementation(unlinkSpy);
    // Use 1-day retention; insert 600 screenshots that are 2+ days old so they all fall before the cutoff
    settingsRepo.update({ activityRetentionDays: 1 });
    const now = new Date('2026-06-25T12:00:00.000Z');
    // computed cutoff = now - 1 day = 2026-06-24T12:00:00.000Z
    // insert rows at 2026-06-22 + i minutes so they are all well before cutoff
    const base = new Date('2026-06-22T00:00:00.000Z');
    const total = 600;
    for (let i = 0; i < total; i++) {
      const ts = new Date(base.getTime() + i * 60_000).toISOString();
      activityRepo.insert({
        kind: 'screenshot_captured',
        payload: { filePath: `/tmp/plover-screens/shot-${i}.png`, width: 1, height: 1 },
        ts,
      });
    }
    const r = await runRetention({ activityRepo, settingsRepo, now });
    expect(r.deleted).toBe(total);
    expect(unlinkSpy).toHaveBeenCalledTimes(total);
  });
});
