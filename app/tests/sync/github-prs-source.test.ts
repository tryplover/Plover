import { describe, expect, it, beforeEach, vi } from 'vitest';

vi.mock('keytar');
vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => '/test'),
  },
}));

import Database from 'better-sqlite3';
import { runMigrations } from '../../src/main/store/db';
import { SettingsRepo } from '../../src/main/store/repos/settings';
import { TypedEventBus } from '../../src/main/events/bus';
import { GitHubPrsSource } from '../../src/main/sync/github/prs-source';
import { GitHubClient } from '../../src/main/sync/github/github-client';
import { GitHubPrPayload } from '../../src/shared/events';

describe('GitHubPrsSource', () => {
  let db: Database.Database;
  let settingsRepo: SettingsRepo;
  let bus: TypedEventBus;
  let fakeClient: GitHubClient;
  let source: GitHubPrsSource;

  beforeEach(() => {
    vi.clearAllMocks();
    db = new Database(':memory:');
    runMigrations(db);
    settingsRepo = new SettingsRepo(db);
    bus = new TypedEventBus();
    fakeClient = { request: vi.fn() } as unknown as GitHubClient;
    settingsRepo.update({ githubConnected: true, githubTrackingEnabled: true });
    source = new GitHubPrsSource(fakeClient, settingsRepo, bus);
  });

  it('first snapshot returns now, emits nothing, and does not call the API', async () => {
    const events: GitHubPrPayload[] = [];
    bus.on('github.pr', (p) => events.push(p));

    const next = await source.poll(null);

    expect(Number.isNaN(Date.parse(next))).toBe(false);
    expect(events).toHaveLength(0);
    expect(fakeClient.request).not.toHaveBeenCalled();
  });

  it('emits github.pr events for each item and returns the max updated_at', async () => {
    (fakeClient.request as ReturnType<typeof vi.fn>).mockResolvedValue({
      status: 200,
      etag: null,
      data: {
        items: [
          {
            repository_url: 'https://api.github.com/repos/o/r',
            number: 1,
            title: 'Add feature',
            state: 'open',
            html_url: 'https://github.com/o/r/pull/1',
            updated_at: '2026-02-01T00:00:00.000Z',
          },
          {
            repository_url: 'https://api.github.com/repos/o/r2',
            number: 2,
            title: 'Merged PR',
            state: 'closed',
            html_url: 'https://github.com/o/r2/pull/2',
            updated_at: '2026-02-02T00:00:00.000Z',
            pull_request: { merged_at: '2026-02-02T00:00:00.000Z' },
          },
        ],
      },
    });
    const events: GitHubPrPayload[] = [];
    bus.on('github.pr', (p) => events.push(p));

    const cursor = '2026-01-01T00:00:00.000Z';
    const next = await source.poll(cursor);

    expect(fakeClient.request).toHaveBeenCalledWith(
      expect.stringContaining('/search/issues?q='),
    );
    expect(fakeClient.request).toHaveBeenCalledWith(
      expect.stringContaining(encodeURIComponent('is:pr involves:@me updated:>=' + cursor)),
    );
    expect(events).toHaveLength(2);
    expect(events[0]).toEqual({
      repo: 'o/r',
      number: 1,
      title: 'Add feature',
      state: 'open',
      action: 'updated',
      url: 'https://github.com/o/r/pull/1',
      updatedAt: '2026-02-01T00:00:00.000Z',
    });
    expect(events[1]).toEqual({
      repo: 'o/r2',
      number: 2,
      title: 'Merged PR',
      state: 'closed',
      action: 'merged',
      url: 'https://github.com/o/r2/pull/2',
      updatedAt: '2026-02-02T00:00:00.000Z',
    });
    expect(next).toBe('2026-02-02T00:00:00.000Z');
  });

  it('does not re-emit the item exactly at the cursor boundary, but emits newer items', async () => {
    const cursor = '2026-01-01T00:00:00.000Z';
    (fakeClient.request as ReturnType<typeof vi.fn>).mockResolvedValue({
      status: 200,
      etag: null,
      data: {
        items: [
          {
            repository_url: 'https://api.github.com/repos/o/r',
            number: 1,
            title: 'At boundary',
            state: 'open',
            html_url: 'https://github.com/o/r/pull/1',
            updated_at: cursor,
          },
          {
            repository_url: 'https://api.github.com/repos/o/r2',
            number: 2,
            title: 'Newer PR',
            state: 'open',
            html_url: 'https://github.com/o/r2/pull/2',
            updated_at: '2026-02-02T00:00:00.000Z',
          },
        ],
      },
    });
    const events: GitHubPrPayload[] = [];
    bus.on('github.pr', (p) => events.push(p));

    const next = await source.poll(cursor);

    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({
      repo: 'o/r2',
      number: 2,
      title: 'Newer PR',
      state: 'open',
      action: 'updated',
      url: 'https://github.com/o/r2/pull/2',
      updatedAt: '2026-02-02T00:00:00.000Z',
    });
    expect(next).toBe('2026-02-02T00:00:00.000Z');
  });

  it('returns the cursor unchanged when there are no items', async () => {
    (fakeClient.request as ReturnType<typeof vi.fn>).mockResolvedValue({
      status: 200,
      etag: null,
      data: { items: [] },
    });
    const events: GitHubPrPayload[] = [];
    bus.on('github.pr', (p) => events.push(p));

    const cursor = '2026-01-01T00:00:00.000Z';
    const next = await source.poll(cursor);

    expect(events).toHaveLength(0);
    expect(next).toBe(cursor);
  });
});
