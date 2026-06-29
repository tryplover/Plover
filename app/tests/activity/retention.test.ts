import { describe, it, expect, beforeEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import { ActivityRepo } from '@main/store/repos/activity.js';
import { SettingsRepo } from '@main/store/repos/settings.js';
import { runMigrations } from '@main/store/db.js';
import { runRetention } from '@main/activity/retention.js';
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
});
