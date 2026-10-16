import { describe, expect, it, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { runMigrations } from '@main/store/db.js';
import { SettingsRepo } from '@main/store/repos/settings.js';

function timerValues(repo: SettingsRepo) {
  const s = repo.getAll();
  return [s.workMinutes, s.shortBreakMinutes, s.longBreakMinutes, s.blocksPerLongBreak];
}

describe('SettingsRepo timer settings', () => {
  let repo: SettingsRepo;

  beforeEach(() => {
    const db = new Database(':memory:');
    runMigrations(db);
    repo = new SettingsRepo(db);
  });

  it('defaults to 25/5 with a 15 minute long break after 4 blocks', () => {
    expect(timerValues(repo)).toEqual([25, 5, 15, 4]);
  });

  it('round-trips valid values', () => {
    repo.update({
      workMinutes: 50,
      shortBreakMinutes: 10,
      longBreakMinutes: 30,
      blocksPerLongBreak: 3,
    });
    expect(timerValues(repo)).toEqual([50, 10, 30, 3]);
  });

  it('clamps out-of-range values on write', () => {
    repo.update({
      workMinutes: 0,
      shortBreakMinutes: 999,
      longBreakMinutes: -5,
      blocksPerLongBreak: 500,
    });
    expect(timerValues(repo)).toEqual([1, 60, 1, 12]);
  });

  it('never lets blocksPerLongBreak reach 0', () => {
    repo.update({ blocksPerLongBreak: 0 });
    expect(repo.getAll().blocksPerLongBreak).toBe(1);
  });

  it('rounds fractional values', () => {
    repo.update({ workMinutes: 24.6 });
    expect(repo.getAll().workMinutes).toBe(25);
  });

  it('falls back to defaults when the stored value is not a number', () => {
    repo.set('workMinutes', 'abc');
    repo.set('shortBreakMinutes', '');
    repo.set('longBreakMinutes', 'NaN');
    repo.set('blocksPerLongBreak', 'many');
    expect(timerValues(repo)).toEqual([25, 5, 15, 4]);
  });

  it('clamps raw stored values on read', () => {
    repo.set('workMinutes', '100000');
    repo.set('blocksPerLongBreak', '-3');
    const s = repo.getAll();
    expect(s.workMinutes).toBe(180);
    expect(s.blocksPerLongBreak).toBe(1);
  });
});
