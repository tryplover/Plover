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
    expect(s.theme).toBe('light');
    expect(s.companionMode).toBe('compact');
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

  it('roundtrips theme setting', () => {
    repo.update({ theme: 'dark' });
    expect(repo.getAll().theme).toBe('dark');
    repo.update({ theme: 'light' });
    expect(repo.getAll().theme).toBe('light');
  });

  it('roundtrips companionMode setting', () => {
    repo.update({ companionMode: 'compact' });
    expect(repo.getAll().companionMode).toBe('compact');
    repo.update({ companionMode: 'full' });
    expect(repo.getAll().companionMode).toBe('full');
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

  it('defaults supabaseUserId/supabaseUserEmail to null when nothing is stored', () => {
    const s = repo.getAll();
    expect(s.supabaseUserId).toBeNull();
    expect(s.supabaseUserEmail).toBeNull();
  });

  it('roundtrips supabaseUserId and supabaseUserEmail', () => {
    repo.update({ supabaseUserId: 'user-1', supabaseUserEmail: 'jordan@example.com' });
    const s = repo.getAll();
    expect(s.supabaseUserId).toBe('user-1');
    expect(s.supabaseUserEmail).toBe('jordan@example.com');
  });

  it('clears supabaseUserId and supabaseUserEmail when updated to null', () => {
    repo.update({ supabaseUserId: 'user-1', supabaseUserEmail: 'jordan@example.com' });
    repo.update({ supabaseUserId: null, supabaseUserEmail: null });
    const s = repo.getAll();
    expect(s.supabaseUserId).toBeNull();
    expect(s.supabaseUserEmail).toBeNull();
  });

  it('defaults lastVisionInferenceWindowKey to null when nothing is stored', () => {
    expect(repo.getAll().lastVisionInferenceWindowKey).toBeNull();
  });

  it('roundtrips and clears lastVisionInferenceWindowKey', () => {
    repo.update({ lastVisionInferenceWindowKey: 'VS Code::auth-service.ts' });
    expect(repo.getAll().lastVisionInferenceWindowKey).toBe('VS Code::auth-service.ts');
    repo.update({ lastVisionInferenceWindowKey: null });
    expect(repo.getAll().lastVisionInferenceWindowKey).toBeNull();
  });

  it('defaults the new Google source toggles to on', () => {
    const s = repo.getAll();
    expect(s.gmailEnabled).toBe(true);
    expect(s.calendarEnabled).toBe(true);
    expect(s.classroomEnabled).toBe(true);
  });

  it('persists a false toggle', () => {
    repo.update({ gmailEnabled: false });
    expect(repo.getAll().gmailEnabled).toBe(false);
  });

  it('defaults GitHub settings to documented values', () => {
    const s = repo.getAll();
    expect(s.githubConnected).toBe(false);
    expect(s.githubTrackingEnabled).toBe(true);
    expect(s.githubWatchedRepos).toEqual([]);
  });

  it('persists GitHub connection status, tracking toggle, and watched repos list', () => {
    repo.update({
      githubConnected: true,
      githubTrackingEnabled: false,
      githubWatchedRepos: ['o/r1', 'o/r2'],
    });
    const s = repo.getAll();
    expect(s.githubConnected).toBe(true);
    expect(s.githubTrackingEnabled).toBe(false);
    expect(s.githubWatchedRepos).toEqual(['o/r1', 'o/r2']);
  });
});
