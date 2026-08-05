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
import { GmailActivitySubscriber } from '../../src/main/activity/gmail-subscriber/gmail-subscriber';

describe('GmailActivitySubscriber', () => {
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

  it('writes a gmail_message activity row on gmail.message when enabled', () => {
    settings.update({ gmailEnabled: true, pauseAllTracking: false });
    new GmailActivitySubscriber(activity, settings, bus).start();
    bus.emit('gmail.message', {
      id: 'm1',
      threadId: 't1',
      from: 'a@b.com',
      subject: 'Hi',
      snippet: 's',
      labels: ['INBOX'],
      receivedAt: '2026-08-04T00:00:00.000Z',
    });
    const rows = activity.list({ kind: 'gmail_message' });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.payload).toMatchObject({ id: 'm1', subject: 'Hi' });
  });

  it('does not write when pauseAllTracking is set', () => {
    settings.update({ gmailEnabled: true, pauseAllTracking: true });
    new GmailActivitySubscriber(activity, settings, bus).start();
    bus.emit('gmail.message', {
      id: 'm1',
      threadId: 't1',
      from: 'a@b.com',
      subject: 'Hi',
      snippet: 's',
      labels: [],
      receivedAt: '2026-08-04T00:00:00.000Z',
    });
    expect(activity.list({ kind: 'gmail_message' })).toHaveLength(0);
  });
});
