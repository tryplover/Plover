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
import { GitHubPrActivitySubscriber } from '../../src/main/activity/github-pr-subscriber/github-pr-subscriber';

describe('GitHubPrActivitySubscriber', () => {
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

  it('writes a github_pr activity row on github.pr when enabled', () => {
    settings.update({ githubTrackingEnabled: true, pauseAllTracking: false });
    new GitHubPrActivitySubscriber(activity, settings, bus).start();
    bus.emit('github.pr', {
      repo: 'o/r',
      number: 1,
      title: 'Add feature',
      state: 'open',
      action: 'updated',
      url: 'https://github.com/o/r/pull/1',
      updatedAt: '2026-08-04T00:00:00.000Z',
    });
    const rows = activity.list({ kind: 'github_pr' });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.payload).toMatchObject({ repo: 'o/r', number: 1 });
  });

  it('does not write when pauseAllTracking is set', () => {
    settings.update({ githubTrackingEnabled: true, pauseAllTracking: true });
    new GitHubPrActivitySubscriber(activity, settings, bus).start();
    bus.emit('github.pr', {
      repo: 'o/r',
      number: 1,
      title: 'Add feature',
      state: 'open',
      action: 'updated',
      url: 'https://github.com/o/r/pull/1',
      updatedAt: '2026-08-04T00:00:00.000Z',
    });
    expect(activity.list({ kind: 'github_pr' })).toHaveLength(0);
  });
});
