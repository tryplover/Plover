import { google } from 'googleapis';
import { CalendarEvent } from '../../shared/types';
import { GoogleAuth, AuthenticationError, PermissionError } from './google-auth';

export interface CalendarSync {
  listEvents(rangeStart: Date, rangeEnd: Date): Promise<CalendarEvent[]>;
  createEvent(input: { taskId: string; title: string; start: Date; end: Date }): Promise<string>;
  deleteEvent(eventId: string): Promise<void>;
}

function handleGoogleError(error: unknown): never {
  if (error && typeof error === 'object') {
    const err = error as Record<string, unknown>;
    const status =
      err.status ||
      err.code ||
      (err.response &&
        typeof err.response === 'object' &&
        (err.response as Record<string, unknown>).status);
    const message = err.message || 'Google API Error';

    if (status === 401) {
      throw new AuthenticationError(`Authentication failed: ${message}`);
    }
    if (status === 403) {
      throw new PermissionError(`Permission denied: ${message}`);
    }
  }
  throw error;
}

export class GoogleCalendarSync implements CalendarSync {
  constructor(private auth: GoogleAuth) {}

  private get calendar() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return google.calendar({ version: 'v3', auth: this.auth.client as unknown as any });
  }

  async listEvents(rangeStart: Date, rangeEnd: Date): Promise<CalendarEvent[]> {
    try {
      const response = await this.calendar.events.list({
        calendarId: 'primary',
        timeMin: rangeStart.toISOString(),
        timeMax: rangeEnd.toISOString(),
        singleEvents: true,
        orderBy: 'startTime',
      });

      const items = response.data.items || [];
      return items
        .map((item) => ({
          id: item.id || '',
          summary: item.summary || '(No title)',
          start: item.start?.dateTime || item.start?.date || '',
          end: item.end?.dateTime || item.end?.date || '',
        }))
        .filter((item) => item.id !== '');
    } catch (error) {
      handleGoogleError(error);
    }
  }

  async createEvent(input: {
    taskId: string;
    title: string;
    start: Date;
    end: Date;
  }): Promise<string> {
    try {
      const response = await this.calendar.events.insert({
        calendarId: 'primary',
        requestBody: {
          summary: input.title,
          description: `Synced from Plover (Task ID: ${input.taskId})`,
          start: {
            dateTime: input.start.toISOString(),
          },
          end: {
            dateTime: input.end.toISOString(),
          },
          extendedProperties: {
            private: {
              taskId: input.taskId,
            },
          },
        },
      });

      if (!response.data.id) {
        throw new Error('Google API did not return an event ID');
      }

      return response.data.id;
    } catch (error) {
      handleGoogleError(error);
    }
  }

  async deleteEvent(eventId: string): Promise<void> {
    try {
      await this.calendar.events.delete({
        calendarId: 'primary',
        eventId: eventId,
      });
    } catch (error: unknown) {
      if (error && typeof error === 'object') {
        const err = error as Record<string, unknown>;
        const status =
          err.status ||
          err.code ||
          (err.response &&
            typeof err.response === 'object' &&
            (err.response as Record<string, unknown>).status);
        if (status === 404 || status === 410) {
          return;
        }
      }
      handleGoogleError(error);
    }
  }
}
