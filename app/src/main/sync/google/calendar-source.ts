import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { TypedEventBus } from '@main/events/bus.js';
import { SettingsData } from '@main/store/repos/settings.js';
import { ContextSource } from '../source-poller.js';

export class CalendarSource implements ContextSource {
  readonly provider = 'google';
  readonly source = 'calendar';

  constructor(private auth: { client: OAuth2Client }, private eventBus: TypedEventBus) {}

  enabled(settings: SettingsData): boolean {
    return settings.googleConnected && settings.calendarEnabled;
  }

  async poll(cursor: string | null): Promise<string> {
    const calendar = google.calendar({ version: 'v3', auth: this.auth.client });
    const emit = cursor !== null;

    let res;
    try {
      res = await calendar.events.list(
        cursor
          ? { calendarId: 'primary', syncToken: cursor, singleEvents: true }
          : { calendarId: 'primary', singleEvents: true, orderBy: 'startTime', timeMin: new Date().toISOString() },
      );
    } catch (err) {
      if ((err as { code?: number }).code === 410) {
        const reseed = await calendar.events.list({
          calendarId: 'primary',
          singleEvents: true,
          orderBy: 'startTime',
          timeMin: new Date().toISOString(),
        });
        return reseed.data.nextSyncToken ?? cursor ?? '';
      }
      throw err;
    }

    if (emit) {
      for (const e of res.data.items ?? []) {
        if (!e.id) continue;
        this.eventBus.emit('calendar.event', {
          id: e.id,
          title: e.summary ?? '(no title)',
          start: e.start?.dateTime ?? e.start?.date ?? '',
          end: e.end?.dateTime ?? e.end?.date ?? '',
          status: e.status ?? 'confirmed',
          attendeeCount: (e.attendees ?? []).length,
          location: e.location ?? null,
        });
      }
    }

    return res.data.nextSyncToken ?? cursor ?? '';
  }
}
