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

describe('SettingsRepo — Supabase auth & subscription keys', () => {
  let db: Database.Database;
  let repo: SettingsRepo;

  beforeEach(() => {
    db = new Database(':memory:');
    runMigrations(db);
    repo = new SettingsRepo(db);
  });

  it('returns correct defaults for Supabase/subscription fields on fresh DB', () => {
    const s = repo.getAll();
    expect(s.supabaseUserId).toBe(null);
    expect(s.supabaseUserEmail).toBe(null);
    expect(s.subscriptionPlan).toBe('free');
    expect(s.subscriptionCheckedAt).toBe(null);
  });

  it('roundtrips updated Supabase/subscription fields', () => {
    repo.update({
      supabaseUserId: 'user-123',
      supabaseUserEmail: 'test@example.com',
      subscriptionPlan: 'paid',
      subscriptionCheckedAt: '2026-07-05T10:30:00Z',
    });
    const s = repo.getAll();
    expect(s.supabaseUserId).toBe('user-123');
    expect(s.supabaseUserEmail).toBe('test@example.com');
    expect(s.subscriptionPlan).toBe('paid');
    expect(s.subscriptionCheckedAt).toBe('2026-07-05T10:30:00Z');
  });

  it('clears nullable Supabase/subscription fields when set to null', () => {
    repo.update({
      supabaseUserId: 'user-123',
      supabaseUserEmail: 'test@example.com',
      subscriptionCheckedAt: '2026-07-05T10:30:00Z',
    });
    const beforeClear = repo.getAll();
    expect(beforeClear.supabaseUserId).toBe('user-123');
    expect(beforeClear.supabaseUserEmail).toBe('test@example.com');
    expect(beforeClear.subscriptionCheckedAt).toBe('2026-07-05T10:30:00Z');

    repo.update({
      supabaseUserId: null,
      supabaseUserEmail: null,
      subscriptionCheckedAt: null,
    });
    const afterClear = repo.getAll();
    expect(afterClear.supabaseUserId).toBe(null);
    expect(afterClear.supabaseUserEmail).toBe(null);
    expect(afterClear.subscriptionCheckedAt).toBe(null);
  });
});
