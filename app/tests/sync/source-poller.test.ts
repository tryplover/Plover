import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import { runMigrations } from '../../src/main/store/db';
import { SettingsRepo } from '../../src/main/store/repos/settings';
import { SyncCursorsRepo } from '../../src/main/store/repos/sync-cursors';
import { SourcePoller, ContextSource } from '../../src/main/sync/source-poller';

function makeSource(over: Partial<ContextSource> = {}): ContextSource {
  return {
    provider: 'google',
    source: 'gmail',
    enabled: () => true,
    poll: vi.fn(async () => 'next-cursor'),
    ...over,
  };
}

describe('SourcePoller', () => {
  let db: Database.Database;
  let settingsRepo: SettingsRepo;
  let cursors: SyncCursorsRepo;

  beforeEach(() => {
    db = new Database(':memory:');
    runMigrations(db);
    settingsRepo = new SettingsRepo(db);
    cursors = new SyncCursorsRepo(db);
  });

  afterEach(() => vi.useRealTimers());

  it('skips when pauseAllTracking is set', async () => {
    settingsRepo.update({ pauseAllTracking: true });
    const source = makeSource();
    await new SourcePoller(source, cursors, settingsRepo, 1000).poll();
    expect(source.poll).not.toHaveBeenCalled();
  });

  it('skips when the source is disabled', async () => {
    const source = makeSource({ enabled: () => false });
    await new SourcePoller(source, cursors, settingsRepo, 1000).poll();
    expect(source.poll).not.toHaveBeenCalled();
  });

  it('skips when preflight returns false', async () => {
    const source = makeSource();
    const poller = new SourcePoller(source, cursors, settingsRepo, 1000, async () => false);
    await poller.poll();
    expect(source.poll).not.toHaveBeenCalled();
  });

  it('passes null cursor on first poll and persists the returned cursor', async () => {
    const source = makeSource({ poll: vi.fn(async (c) => { expect(c).toBeNull(); return 'c1'; }) });
    await new SourcePoller(source, cursors, settingsRepo, 1000).poll();
    expect(cursors.get('google', 'gmail')).toBe('c1');
  });

  it('passes the stored cursor on the next poll', async () => {
    cursors.set('google', 'gmail', 'c1');
    const source = makeSource({ poll: vi.fn(async (c) => { expect(c).toBe('c1'); return 'c2'; }) });
    await new SourcePoller(source, cursors, settingsRepo, 1000).poll();
    expect(cursors.get('google', 'gmail')).toBe('c2');
  });

  it('does not throw when the source poll rejects', async () => {
    const source = makeSource({ poll: vi.fn(async () => { throw new Error('boom'); }) });
    await expect(new SourcePoller(source, cursors, settingsRepo, 1000).poll()).resolves.not.toThrow();
  });
});
