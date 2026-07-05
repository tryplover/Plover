import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import nock from 'nock';
import Database from 'better-sqlite3';
import { runMigrations } from '../../src/main/store/db';
import { SettingsRepo } from '../../src/main/store/repos/settings';
import { ActivityRepo } from '../../src/main/store/repos/activity';
import { GoogleAuth } from '../../src/main/sync/google-auth';
import { GDocsPoller } from '../../src/main/activity/gdocs-poller';

const { mockKeychain } = vi.hoisted(() => {
  return {
    mockKeychain: new Map<string, string>(),
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
    openExternal: vi.fn().mockResolvedValue(true),
  },
}));

describe('GDocsPoller', () => {
  let db: Database.Database;
  let settingsRepo: SettingsRepo;
  let activityRepo: ActivityRepo;
  let auth: GoogleAuth;

  beforeEach(() => {
    mockKeychain.clear();
    db = new Database(':memory:');
    runMigrations(db);
    settingsRepo = new SettingsRepo(db);
    activityRepo = new ActivityRepo(db);
    auth = new GoogleAuth();
  });

  afterEach(() => {
    nock.cleanAll();
    vi.useRealTimers();
  });

  it('should not poll if googleConnected is false', async () => {
    settingsRepo.update({ googleConnected: false });
    auth.client.setCredentials({ access_token: 'test-token' });

    const poller = new GDocsPoller(auth, activityRepo, settingsRepo, 1000);

    const isAuthorizedSpy = vi.spyOn(auth, 'isAuthorized');

    await poller.poll();

    expect(isAuthorizedSpy).not.toHaveBeenCalled();
    expect(activityRepo.list()).toHaveLength(0);
  });

  it('should not poll if googleConnected is true but isAuthorized is false', async () => {
    settingsRepo.update({ googleConnected: true });
    // client has no credentials, so isAuthorized is false

    const poller = new GDocsPoller(auth, activityRepo, settingsRepo, 1000);

    const isAuthorizedSpy = vi.spyOn(auth, 'isAuthorized');

    await poller.poll();

    expect(isAuthorizedSpy).toHaveBeenCalled();
    expect(activityRepo.list()).toHaveLength(0);
  });

  it('should poll Google Drive files and record activity if authorized and connected', async () => {
    settingsRepo.update({ googleConnected: true });
    auth.client.setCredentials({ access_token: 'test-token' });

    const poller = new GDocsPoller(auth, activityRepo, settingsRepo, 1000);
    const initialPollTime = poller.lastPollTime.toISOString();

    const doc1Time = new Date(Date.now() + 1000).toISOString();
    const doc2Time = new Date(Date.now() + 2000).toISOString();
    const mockFilesResponse = {
      files: [
        {
          id: 'doc-1',
          name: 'Google Doc 1',
          modifiedTime: doc1Time,
        },
        {
          id: 'doc-2',
          name: 'Google Doc 2',
          modifiedTime: doc2Time,
        },
      ],
    };

    nock('https://www.googleapis.com')
      .get('/drive/v3/files')
      .query((q) => {
        expect(q.q).toContain("mimeType = 'application/vnd.google-apps.document'");
        expect(q.q).toContain(`modifiedTime > '${initialPollTime}'`);
        expect(q.orderBy).toBe('modifiedTime asc');
        expect(q.fields).toBe('files(id, name, modifiedTime)');
        return true;
      })
      .reply(200, mockFilesResponse)
      .persist();

    await poller.poll();

    const activities = activityRepo.list({ kind: 'gdocs_revision' });
    expect(activities).toHaveLength(2);
    // list() returns in descending order of ts
    expect(activities[0]).toEqual(
      expect.objectContaining({
        kind: 'gdocs_revision',
        payload: {
          fileId: 'doc-2',
          name: 'Google Doc 2',
          modifiedTime: doc2Time,
        },
      }),
    );
    expect(activities[1]).toEqual(
      expect.objectContaining({
        kind: 'gdocs_revision',
        payload: {
          fileId: 'doc-1',
          name: 'Google Doc 1',
          modifiedTime: doc1Time,
        },
      }),
    );

    expect(poller.lastPollTime.toISOString()).toBe(doc2Time);
  });

  it('should handle API errors gracefully', async () => {
    settingsRepo.update({ googleConnected: true });
    auth.client.setCredentials({ access_token: 'test-token' });

    const poller = new GDocsPoller(auth, activityRepo, settingsRepo, 1000);

    nock('https://www.googleapis.com')
      .get('/drive/v3/files')
      .query(() => true)
      .reply(500, 'Internal Server Error')
      .persist();

    await expect(poller.poll()).resolves.not.toThrow();
    expect(activityRepo.list()).toHaveLength(0);
  });

  it('should trigger polling periodically via start/stop and setInterval', async () => {
    vi.useFakeTimers();
    settingsRepo.update({ googleConnected: true });
    auth.client.setCredentials({ access_token: 'test-token' });

    const poller = new GDocsPoller(auth, activityRepo, settingsRepo, 1000);
    const pollSpy = vi.spyOn(poller, 'poll').mockResolvedValue(undefined);

    poller.start();

    await vi.advanceTimersByTimeAsync(1000);
    expect(pollSpy).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(2000);
    expect(pollSpy).toHaveBeenCalledTimes(3);

    poller.stop();

    await vi.advanceTimersByTimeAsync(2000);
    expect(pollSpy).toHaveBeenCalledTimes(3);
  });

  it('skips polling when gdocsPollingEnabled is false', async () => {
    settingsRepo.update({ googleConnected: true, gdocsPollingEnabled: false });
    auth.client.setCredentials({ access_token: 'test-token' });

    const poller = new GDocsPoller(auth, activityRepo, settingsRepo, 1000);

    const isAuthorizedSpy = vi.spyOn(auth, 'isAuthorized');

    await poller.poll();

    expect(isAuthorizedSpy).not.toHaveBeenCalled();
    expect(activityRepo.list()).toHaveLength(0);
  });

  it('skips polling when pauseAllTracking is true', async () => {
    settingsRepo.update({ googleConnected: true, pauseAllTracking: true });
    auth.client.setCredentials({ access_token: 'test-token' });

    const poller = new GDocsPoller(auth, activityRepo, settingsRepo, 1000);

    const isAuthorizedSpy = vi.spyOn(auth, 'isAuthorized');

    await poller.poll();

    expect(isAuthorizedSpy).not.toHaveBeenCalled();
    expect(activityRepo.list()).toHaveLength(0);
  });
});
