import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { SettingsRepo } from '../../src/main/store/repos/settings.js';
import { runMigrations } from '../../src/main/store/db.js';

describe('SettingsRepo — Phase 2 activity tracking keys', () => {
  let db: Database.Database;
  let repo: SettingsRepo;

  beforeEach(() => {
    db = new Database(':memory:');
    runMigrations(db);
    repo = new SettingsRepo(db);
  });

  it('returns the documented defaults when nothing is stored', () => {
    const s = repo.getAll();
    expect(s.pauseAllTracking).toBe(false);
    expect(s.windowTrackingEnabled).toBe(true);
    expect(s.gdocsPollingEnabled).toBe(true);
    expect(s.fileWatchingEnabled).toBe(true);
    expect(s.screenCaptureEnabled).toBe(false);
    expect(s.screenCaptureIntervalMinutes).toBe(5);
    expect(s.screenVisionInferenceEnabled).toBe(false);
    expect(s.activityRetentionDays).toBe(30);
    expect(s.planner_useRecentActivityContext).toBe(true);
  });

  it('roundtrips updated activity keys', () => {
    repo.update({
      screenCaptureEnabled: true,
      screenCaptureIntervalMinutes: 10,
      screenVisionInferenceEnabled: true,
      activityRetentionDays: 7,
      pauseAllTracking: true,
      planner_useRecentActivityContext: false,
    });
    const s = repo.getAll();
    expect(s.screenCaptureEnabled).toBe(true);
    expect(s.screenCaptureIntervalMinutes).toBe(10);
    expect(s.screenVisionInferenceEnabled).toBe(true);
    expect(s.activityRetentionDays).toBe(7);
    expect(s.pauseAllTracking).toBe(true);
    expect(s.planner_useRecentActivityContext).toBe(false);
  });

  it('clamps screenCaptureIntervalMinutes to [1, 60]', () => {
    repo.update({ screenCaptureIntervalMinutes: 0 });
    expect(repo.getAll().screenCaptureIntervalMinutes).toBe(1);
    repo.update({ screenCaptureIntervalMinutes: 999 });
    expect(repo.getAll().screenCaptureIntervalMinutes).toBe(60);
  });
});
