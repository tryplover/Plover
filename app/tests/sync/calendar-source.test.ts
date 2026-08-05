import { describe, expect, it, beforeEach, vi } from 'vitest';

const { calendarStub } = vi.hoisted(() => ({ calendarStub: { events: { list: vi.fn() } } }));

vi.mock('googleapis', () => ({
  google: {
    auth: {
      OAuth2: class {
        setCredentials() {
          // Mock implementation
        }

        generateAuthUrl() {
          return '';
        }

        getToken() {
          return { tokens: {} };
        }

        get credentials() {
          return {};
        }
      },
    },
    calendar: vi.fn(() => calendarStub),
  },
}));

import { CalendarSource } from '../../src/main/sync/google/calendar-source';
import { TypedEventBus } from '../../src/main/events/bus';
import { CalendarEventPayload } from '../../src/shared/events';

describe('CalendarSource', () => {
  let bus: TypedEventBus;
  let source: CalendarSource;

  beforeEach(() => {
    vi.clearAllMocks();
    bus = new TypedEventBus();
    source = new CalendarSource({ client: {} as never }, bus);
  });

  it('first snapshot fetches a syncToken and emits nothing', async () => {
    calendarStub.events.list.mockResolvedValue({ data: { items: [{ id: 'e1' }], nextSyncToken: 'tok1' } });
    const events: CalendarEventPayload[] = [];
    bus.on('calendar.event', (p) => events.push(p));

    const next = await source.poll(null);

    expect(next).toBe('tok1');
    expect(events).toHaveLength(0);
  });

  it('emits changed events since the syncToken and returns the new token', async () => {
    calendarStub.events.list.mockResolvedValue({
      data: {
        nextSyncToken: 'tok2',
        items: [
          {
            id: 'e1',
            summary: 'Standup',
            status: 'confirmed',
            location: 'Room 1',
            start: { dateTime: '2026-08-05T09:00:00Z' },
            end: { dateTime: '2026-08-05T09:15:00Z' },
            attendees: [{ email: 'a@b.com' }, { email: 'c@d.com' }],
          },
        ],
      },
    });
    const events: CalendarEventPayload[] = [];
    bus.on('calendar.event', (p) => events.push(p));

    const next = await source.poll('tok1');

    expect(calendarStub.events.list).toHaveBeenCalledWith(expect.objectContaining({ syncToken: 'tok1' }));
    expect(next).toBe('tok2');
    expect(events[0]).toEqual({
      id: 'e1',
      title: 'Standup',
      start: '2026-08-05T09:00:00Z',
      end: '2026-08-05T09:15:00Z',
      status: 'confirmed',
      attendeeCount: 2,
      location: 'Room 1',
    });
  });

  it('reseeds on a 410 GONE without emitting', async () => {
    calendarStub.events.list
      .mockRejectedValueOnce(Object.assign(new Error('gone'), { code: 410 }))
      .mockResolvedValueOnce({ data: { items: [], nextSyncToken: 'tok3' } });
    const events: CalendarEventPayload[] = [];
    bus.on('calendar.event', (p) => events.push(p));

    const next = await source.poll('stale');

    expect(next).toBe('tok3');
    expect(events).toHaveLength(0);
  });
});
