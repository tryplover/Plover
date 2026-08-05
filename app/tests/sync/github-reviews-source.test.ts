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
import { GitHubReviewsSource } from '../../src/main/sync/github/reviews-source';
import { GitHubClient } from '../../src/main/sync/github/github-client';
import { GitHubReviewPayload } from '../../src/shared/events';

describe('GitHubReviewsSource', () => {
  let db: Database.Database;
  let settingsRepo: SettingsRepo;
  let bus: TypedEventBus;
  let fakeClient: GitHubClient;
  let source: GitHubReviewsSource;

  beforeEach(() => {
    vi.clearAllMocks();
    db = new Database(':memory:');
    runMigrations(db);
    settingsRepo = new SettingsRepo(db);
    bus = new TypedEventBus();
    fakeClient = { request: vi.fn() } as unknown as GitHubClient;
    settingsRepo.update({ githubConnected: true, githubTrackingEnabled: true });
    source = new GitHubReviewsSource(fakeClient, settingsRepo, bus);
  });

  it('first snapshot returns now, emits nothing, and does not call the API', async () => {
    const events: GitHubReviewPayload[] = [];
    bus.on('github.review', (p) => events.push(p));

    const next = await source.poll(null);

    expect(Number.isNaN(Date.parse(next))).toBe(false);
    expect(events).toHaveLength(0);
    expect(fakeClient.request).not.toHaveBeenCalled();
  });

  it('emits requested and mentioned events and returns the max updated_at across both calls', async () => {
    (fakeClient.request as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({
        status: 200,
        etag: null,
        data: {
          items: [
            {
              repository_url: 'https://api.github.com/repos/o/r',
              number: 1,
              html_url: 'https://github.com/o/r/pull/1',
              updated_at: '2026-02-01T00:00:00.000Z',
            },
          ],
        },
      })
      .mockResolvedValueOnce({
        status: 200,
        etag: null,
        data: [
          {
            reason: 'mention',
            subject: { type: 'PullRequest', url: 'https://api.github.com/repos/o/r2/pulls/42' },
            repository: { full_name: 'o/r2' },
            updated_at: '2026-02-05T00:00:00.000Z',
          },
        ],
      });
    const events: GitHubReviewPayload[] = [];
    bus.on('github.review', (p) => events.push(p));

    const cursor = '2026-01-01T00:00:00.000Z';
    const next = await source.poll(cursor);

    expect(fakeClient.request).toHaveBeenCalledWith(
      expect.stringContaining('/search/issues?q='),
    );
    expect(fakeClient.request).toHaveBeenCalledWith(
      expect.stringContaining(
        encodeURIComponent('is:pr review-requested:@me updated:>=' + cursor),
      ),
    );
    expect(fakeClient.request).toHaveBeenCalledWith(
      expect.stringContaining('/notifications?all=false&since='),
    );
    expect(fakeClient.request).toHaveBeenCalledWith(
      expect.stringContaining(encodeURIComponent(cursor)),
    );

    expect(events).toHaveLength(2);
    expect(events[0]).toEqual({
      repo: 'o/r',
      prNumber: 1,
      kind: 'requested',
      url: 'https://github.com/o/r/pull/1',
      updatedAt: '2026-02-01T00:00:00.000Z',
    });
    expect(events[1]).toEqual({
      repo: 'o/r2',
      prNumber: 42,
      kind: 'mentioned',
      url: 'https://api.github.com/repos/o/r2/pulls/42',
      updatedAt: '2026-02-05T00:00:00.000Z',
    });
    expect(next).toBe('2026-02-05T00:00:00.000Z');
  });

  it('returns the cursor unchanged when both calls are empty', async () => {
    (fakeClient.request as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ status: 200, etag: null, data: { items: [] } })
      .mockResolvedValueOnce({ status: 200, etag: null, data: [] });
    const events: GitHubReviewPayload[] = [];
    bus.on('github.review', (p) => events.push(p));

    const cursor = '2026-01-01T00:00:00.000Z';
    const next = await source.poll(cursor);

    expect(events).toHaveLength(0);
    expect(next).toBe(cursor);
  });
});
