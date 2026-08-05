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
import { GitHubCommitsSource } from '../../src/main/sync/github/commits-source';
import { GitHubClient } from '../../src/main/sync/github/github-client';
import { GitHubCommitPayload } from '../../src/shared/events';

describe('GitHubCommitsSource', () => {
  let db: Database.Database;
  let settingsRepo: SettingsRepo;
  let bus: TypedEventBus;
  let fakeClient: GitHubClient;
  let source: GitHubCommitsSource;

  beforeEach(() => {
    vi.clearAllMocks();
    db = new Database(':memory:');
    runMigrations(db);
    settingsRepo = new SettingsRepo(db);
    bus = new TypedEventBus();
    fakeClient = { request: vi.fn() } as unknown as GitHubClient;
    settingsRepo.update({ githubConnected: true, githubWatchedRepos: ['o/r'] });
    source = new GitHubCommitsSource(fakeClient, settingsRepo, bus);
  });

  it('first snapshot seeds a map of repo -> now and emits nothing without calling the API', async () => {
    const events: GitHubCommitPayload[] = [];
    bus.on('github.commit', (p) => events.push(p));

    const next = await source.poll(null);
    const map = JSON.parse(next) as Record<string, string>;

    expect(Object.keys(map)).toEqual(['o/r']);
    expect(Number.isNaN(Date.parse(map['o/r'] as string))).toBe(false);
    expect(events).toHaveLength(0);
    expect(fakeClient.request).not.toHaveBeenCalled();
  });

  it('emits a github.commit event for commits after the cursor and advances the map', async () => {
    (fakeClient.request as ReturnType<typeof vi.fn>).mockResolvedValue({
      status: 200,
      etag: null,
      data: [
        {
          sha: 'abc123',
          html_url: 'https://github.com/o/r/commit/abc123',
          author: { login: 'octocat' },
          commit: {
            message: 'Fix bug',
            author: { name: 'Octo Cat', date: '2026-02-01T00:00:00.000Z' },
          },
        },
      ],
    });
    const events: GitHubCommitPayload[] = [];
    bus.on('github.commit', (p) => events.push(p));

    const cursor = JSON.stringify({ 'o/r': '2026-01-01T00:00:00.000Z' });
    const next = await source.poll(cursor);
    const map = JSON.parse(next) as Record<string, string>;

    expect(fakeClient.request).toHaveBeenCalledWith(
      expect.stringContaining('/repos/o/r/commits?since='),
    );
    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({
      repo: 'o/r',
      sha: 'abc123',
      message: 'Fix bug',
      author: 'octocat',
      url: 'https://github.com/o/r/commit/abc123',
      committedAt: '2026-02-01T00:00:00.000Z',
    });
    expect(map['o/r']).toBe('2026-02-01T00:00:00.000Z');
  });

  it('does not emit a commit whose date is not after the cursor', async () => {
    (fakeClient.request as ReturnType<typeof vi.fn>).mockResolvedValue({
      status: 200,
      etag: null,
      data: [
        {
          sha: 'old1',
          html_url: 'https://github.com/o/r/commit/old1',
          author: { login: 'octocat' },
          commit: {
            message: 'Old commit',
            author: { name: 'Octo Cat', date: '2026-01-01T00:00:00.000Z' },
          },
        },
      ],
    });
    const events: GitHubCommitPayload[] = [];
    bus.on('github.commit', (p) => events.push(p));

    const cursor = JSON.stringify({ 'o/r': '2026-01-01T00:00:00.000Z' });
    await source.poll(cursor);

    expect(events).toHaveLength(0);
  });
});
