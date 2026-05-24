import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import nock from 'nock';
import http from 'http';
import { GoogleAuth, AuthenticationError, PermissionError } from '../../src/main/sync/google-auth';
import { GoogleCalendarSync } from '../../src/main/sync/calendar';

const { mockKeychain, mockOpenExternal } = vi.hoisted(() => {
  return {
    mockKeychain: new Map<string, string>(),
    mockOpenExternal: vi.fn().mockResolvedValue(true),
  };
});

vi.mock('keytar', () => ({
  default: {
    getPassword: vi.fn(async (service: string, account: string) => {
      return mockKeychain.get(`${service}:${account}`) || null;
    }),
    setPassword: vi.fn(async (service: string, account: string, secret: string) => {
      mockKeychain.set(`${service}:${account}`, secret);
    }),
    deletePassword: vi.fn(async (service: string, account: string) => {
      mockKeychain.delete(`${service}:${account}`);
      return true;
    }),
  },
}));

vi.mock('electron', () => ({
  shell: {
    openExternal: mockOpenExternal,
  },
}));

describe('Google Calendar Sync & OAuth', () => {
  beforeEach(() => {
    mockKeychain.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    nock.cleanAll();
  });

  describe('GoogleAuth', () => {
    it('should load saved credentials from keychain if they exist', async () => {
      mockKeychain.set('tendril:google-refresh-token', 'saved-refresh-token');
      const auth = new GoogleAuth();
      const loaded = await auth.loadSavedCredentials();
      expect(loaded).toBe(true);
      expect(auth.client.credentials.refresh_token).toBe('saved-refresh-token');
    });

    it('should return false if credentials do not exist in keychain', async () => {
      const auth = new GoogleAuth();
      const loaded = await auth.loadSavedCredentials();
      expect(loaded).toBe(false);
      expect(auth.client.credentials.refresh_token).toBeUndefined();
    });

    it('should disconnect and remove credentials from keychain', async () => {
      mockKeychain.set('tendril:google-refresh-token', 'some-token');
      const auth = new GoogleAuth();
      await auth.loadSavedCredentials();

      await auth.disconnect();
      expect(mockKeychain.get('tendril:google-refresh-token')).toBeUndefined();
      expect(auth.client.credentials.refresh_token).toBeUndefined();
    });

    it('should start the loopback server and exchange code for token', async () => {
      nock('https://oauth2.googleapis.com').post('/token').reply(200, {
        access_token: 'new-access-token',
        refresh_token: 'new-refresh-token',
        expires_in: 3600,
      });

      const auth = new GoogleAuth();

      mockOpenExternal.mockImplementationOnce(async (urlStr: string) => {
        const parsedUrl = new URL(urlStr);
        const redirectUri = parsedUrl.searchParams.get('redirect_uri');
        expect(redirectUri).toBeDefined();

        const callbackUrl = `${redirectUri}?code=test-auth-code`;
        await new Promise<void>((resolve, reject) => {
          http
            .get(callbackUrl, (res) => {
              expect(res.statusCode).toBe(200);
              resolve();
            })
            .on('error', reject);
        });
        return true;
      });

      await auth.authorize();

      expect(auth.client.credentials.refresh_token).toBe('new-refresh-token');
      expect(mockKeychain.get('tendril:google-refresh-token')).toBe('new-refresh-token');
    });

    it('should handle oauth errors in loopback callback', async () => {
      const auth = new GoogleAuth();

      mockOpenExternal.mockImplementationOnce(async (urlStr: string) => {
        const parsedUrl = new URL(urlStr);
        const redirectUri = parsedUrl.searchParams.get('redirect_uri');

        const callbackUrl = `${redirectUri}?error=access_denied`;
        await new Promise<void>((resolve) => {
          http.get(callbackUrl, (res) => {
            expect(res.statusCode).toBe(400);
            resolve();
          });
        });
        return true;
      });

      await expect(auth.authorize()).rejects.toThrow(AuthenticationError);
    });

    it('should ignore favicon.ico and keep the server running for a valid code', async () => {
      nock('https://oauth2.googleapis.com').post('/token').reply(200, {
        access_token: 'new-access-token',
        refresh_token: 'new-refresh-token',
      });

      const auth = new GoogleAuth();

      mockOpenExternal.mockImplementationOnce(async (urlStr: string) => {
        const parsedUrl = new URL(urlStr);
        const redirectUri = parsedUrl.searchParams.get('redirect_uri');

        const faviconUrl = `${redirectUri}/favicon.ico`;
        await new Promise<void>((resolve) => {
          http.get(faviconUrl, (res) => {
            expect(res.statusCode).toBe(404);
            resolve();
          });
        });

        const callbackUrl = `${redirectUri}?code=test-auth-code`;
        await new Promise<void>((resolve) => {
          http.get(callbackUrl, (res) => {
            expect(res.statusCode).toBe(200);
            resolve();
          });
        });
        return true;
      });

      await auth.authorize();
      expect(auth.client.credentials.refresh_token).toBe('new-refresh-token');
    });
  });

  describe('GoogleCalendarSync', () => {
    let auth: GoogleAuth;
    let calendarSync: GoogleCalendarSync;

    beforeEach(() => {
      auth = new GoogleAuth();
      auth.client.setCredentials({ access_token: 'test-access-token' });
      calendarSync = new GoogleCalendarSync(auth);
    });

    it('should list events in date range', async () => {
      const rangeStart = new Date('2026-05-24T00:00:00Z');
      const rangeEnd = new Date('2026-05-24T23:59:59Z');

      nock('https://www.googleapis.com')
        .get('/calendar/v3/calendars/primary/events')
        .query({
          timeMin: rangeStart.toISOString(),
          timeMax: rangeEnd.toISOString(),
          singleEvents: 'true',
          orderBy: 'startTime',
        })
        .reply(200, {
          items: [
            {
              id: 'event-1',
              summary: 'Meeting 1',
              start: { dateTime: '2026-05-24T10:00:00Z' },
              end: { dateTime: '2026-05-24T11:00:00Z' },
            },
            {
              id: 'event-2',
              summary: 'Meeting 2',
              start: { date: '2026-05-24' },
              end: { date: '2026-05-25' },
            },
          ],
        });

      const events = await calendarSync.listEvents(rangeStart, rangeEnd);
      expect(events).toHaveLength(2);
      expect(events[0]).toEqual({
        id: 'event-1',
        summary: 'Meeting 1',
        start: '2026-05-24T10:00:00Z',
        end: '2026-05-24T11:00:00Z',
      });
      expect(events[1]).toEqual({
        id: 'event-2',
        summary: 'Meeting 2',
        start: '2026-05-24',
        end: '2026-05-25',
      });
    });

    it('should create a new event and return the event id', async () => {
      const input = {
        taskId: 'task-123',
        title: 'Do homework',
        start: new Date('2026-05-24T14:00:00Z'),
        end: new Date('2026-05-24T15:00:00Z'),
      };

      nock('https://www.googleapis.com')
        .post('/calendar/v3/calendars/primary/events')
        .reply(200, (uri, requestBody: unknown) => {
          const body = requestBody as {
            summary: string;
            start: { dateTime: string };
            end: { dateTime: string };
            extendedProperties: {
              private: {
                taskId: string;
              };
            };
          };
          expect(body.summary).toBe(input.title);
          expect(body.start.dateTime).toBe(input.start.toISOString());
          expect(body.end.dateTime).toBe(input.end.toISOString());
          expect(body.extendedProperties.private.taskId).toBe(input.taskId);
          return { id: 'created-event-id' };
        });

      const eventId = await calendarSync.createEvent(input);
      expect(eventId).toBe('created-event-id');
    });

    it('should delete an existing event', async () => {
      const eventId = 'event-to-delete';

      nock('https://www.googleapis.com')
        .delete(`/calendar/v3/calendars/primary/events/${eventId}`)
        .reply(204);

      await expect(calendarSync.deleteEvent(eventId)).resolves.not.toThrow();
    });

    it('should succeed silently if deleting a non-existent event (404/410)', async () => {
      const eventId = 'event-gone';

      nock('https://www.googleapis.com')
        .delete(`/calendar/v3/calendars/primary/events/${eventId}`)
        .reply(404, { error: { message: 'Not found' } });

      await expect(calendarSync.deleteEvent(eventId)).resolves.not.toThrow();

      nock('https://www.googleapis.com')
        .delete(`/calendar/v3/calendars/primary/events/${eventId}`)
        .reply(410, { error: { message: 'Gone' } });

      await expect(calendarSync.deleteEvent(eventId)).resolves.not.toThrow();
    });

    it('should throw AuthenticationError on 401 response', async () => {
      nock('https://www.googleapis.com')
        .get('/calendar/v3/calendars/primary/events')
        .query(true)
        .reply(401, { error: { message: 'Invalid credentials' } });

      await expect(calendarSync.listEvents(new Date(), new Date())).rejects.toThrow(
        AuthenticationError,
      );
    });

    it('should throw PermissionError on 403 response', async () => {
      nock('https://www.googleapis.com')
        .get('/calendar/v3/calendars/primary/events')
        .query(true)
        .reply(403, { error: { message: 'Rate limit exceeded or permission denied' } });

      await expect(calendarSync.listEvents(new Date(), new Date())).rejects.toThrow(
        PermissionError,
      );
    });
  });
});
