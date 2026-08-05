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
import { CalendarActivitySubscriber } from '../../src/main/activity/calendar-subscriber/calendar-subscriber';

describe('CalendarActivitySubscriber', () => {
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

  it('writes a calendar_event activity row on calendar.event when enabled', () => {
    settings.update({ calendarEnabled: true, pauseAllTracking: false });
    new CalendarActivitySubscriber(activity, settings, bus).start();
    bus.emit('calendar.event', {
      id: 'e1',
      title: 'Standup',
      start: '2026-08-05T09:00:00Z',
      end: '2026-08-05T09:15:00Z',
      status: 'confirmed',
      attendeeCount: 2,
      location: 'Room 1',
    });
    const rows = activity.list({ kind: 'calendar_event' });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.payload).toMatchObject({ id: 'e1', title: 'Standup' });
  });

  it('does not write when pauseAllTracking is set', () => {
    settings.update({ calendarEnabled: true, pauseAllTracking: true });
    new CalendarActivitySubscriber(activity, settings, bus).start();
    bus.emit('calendar.event', {
      id: 'e1',
      title: 'Standup',
      start: '2026-08-05T09:00:00Z',
      end: '2026-08-05T09:15:00Z',
      status: 'confirmed',
      attendeeCount: 2,
      location: 'Room 1',
    });
    expect(activity.list({ kind: 'calendar_event' })).toHaveLength(0);
  });
});
