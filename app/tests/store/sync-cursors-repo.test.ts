import { describe, expect, it, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { runMigrations } from '../../src/main/store/db';
import { SyncCursorsRepo } from '../../src/main/store/repos/sync-cursors';

describe('SyncCursorsRepo', () => {
  let db: Database.Database;
  let repo: SyncCursorsRepo;

  beforeEach(() => {
    db = new Database(':memory:');
    runMigrations(db);
    repo = new SyncCursorsRepo(db);
  });

  it('returns null for an unknown cursor', () => {
    expect(repo.get('google', 'gmail')).toBeNull();
  });

  it('upserts and reads a cursor', () => {
    repo.set('google', 'gmail', '12345');
    expect(repo.get('google', 'gmail')).toBe('12345');
    repo.set('google', 'gmail', '67890');
    expect(repo.get('google', 'gmail')).toBe('67890');
  });

  it('clears all cursors for a provider only', () => {
    repo.set('google', 'gmail', 'a');
    repo.set('google', 'calendar', 'b');
    repo.set('github', 'commits', 'c');
    repo.clear('google');
    expect(repo.get('google', 'gmail')).toBeNull();
    expect(repo.get('google', 'calendar')).toBeNull();
    expect(repo.get('github', 'commits')).toBe('c');
  });
});
