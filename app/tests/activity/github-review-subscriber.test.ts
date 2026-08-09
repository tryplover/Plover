import { describe, expect, it, beforeEach, vi } from 'vitest';

vi.mock('keytar');
vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => '/test'),
  },
}));

import Database from 'better-sqlite3';
import { runMigrations } from '../../src/main/store/db';
import { ActivityRepo } from '../../src/main/store/repos/activity';
import { SettingsRepo } from '../../src/main/store/repos/settings';
import { TypedEventBus } from '../../src/main/events/bus';
import { GitHubReviewActivitySubscriber } from '../../src/main/activity/sources/github/github-review-subscriber/github-review-subscriber';

describe('GitHubReviewActivitySubscriber', () => {
  let db: Database.Database;
  let activity: ActivityRepo;
  let settings: SettingsRepo;
  let bus: TypedEventBus;

  beforeEach(() => {
    vi.clearAllMocks();
    db = new Database(':memory:');
    runMigrations(db);
    activity = new ActivityRepo(db);
    settings = new SettingsRepo(db);
    bus = new TypedEventBus();
  });

  it('writes a github_review activity row on github.review when enabled', () => {
    settings.update({ githubTrackingEnabled: true, pauseAllTracking: false });
    new GitHubReviewActivitySubscriber(activity, settings, bus).start();
    bus.emit('github.review', {
      repo: 'o/r',
      prNumber: 1,
      kind: 'requested',
      url: 'https://github.com/o/r/pull/1',
      updatedAt: '2026-08-04T00:00:00.000Z',
    });
    const rows = activity.list({ kind: 'github_review' });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.payload).toMatchObject({ repo: 'o/r', prNumber: 1 });
  });

  it('does not write when pauseAllTracking is set', () => {
    settings.update({ githubTrackingEnabled: true, pauseAllTracking: true });
    new GitHubReviewActivitySubscriber(activity, settings, bus).start();
    bus.emit('github.review', {
      repo: 'o/r',
      prNumber: 1,
      kind: 'requested',
      url: 'https://github.com/o/r/pull/1',
      updatedAt: '2026-08-04T00:00:00.000Z',
    });
    expect(activity.list({ kind: 'github_review' })).toHaveLength(0);
  });
});
