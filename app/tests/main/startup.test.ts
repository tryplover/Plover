import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const constructed = vi.hoisted(() => ({
  gdocsPoller: 0,
  sourcePoller: 0,
  activityInits: 0,
}));

type Deep = ((...args: unknown[]) => Deep) & { [key: string]: Deep };

const deep = vi.hoisted(() => {
  const make = (overrides: Record<string, unknown> = {}): Deep =>
    new Proxy((() => undefined) as unknown as Deep, {
      get: (_target, prop) => {
        if (typeof prop === 'string' && prop in overrides) return overrides[prop];
        if (prop === 'then') return undefined;
        return make();
      },
      apply: () => make(),
    });
  return make;
});

vi.mock('electron', () => {
  const BrowserWindow = Object.assign(
    function () {
      return deep();
    },
    { getAllWindows: () => [] },
  );
  return {
    app: deep({
      isPackaged: false,
      requestSingleInstanceLock: () => true,
      whenReady: () => Promise.resolve(),
    }),
    BrowserWindow,
    globalShortcut: deep({ register: () => true }),
    nativeImage: deep(),
  };
});

vi.mock('@main/load-env.js', () => ({}));

vi.mock('@main/ipc/index.js', () => ({
  setupIpc: () => () => ({ show: () => undefined }),
  googleAuth: {},
  githubAuth: {},
}));

vi.mock('@main/sync/gdocs-poller.js', () => ({
  GDocsPoller: class {
    constructor() {
      constructed.gdocsPoller += 1;
    }
    start = () => undefined;
    stop = () => undefined;
  },
}));

vi.mock('@main/sync/source-poller.js', () => ({
  SourcePoller: class {
    constructor() {
      constructed.sourcePoller += 1;
    }
    start = () => undefined;
    stop = () => undefined;
  },
}));

vi.mock('@main/sync/google/gmail-source.js', () => ({ GmailSource: vi.fn() }));
vi.mock('@main/sync/google/calendar-source.js', () => ({ CalendarSource: vi.fn() }));
vi.mock('@main/sync/google/classroom-source.js', () => ({ ClassroomSource: vi.fn() }));
vi.mock('@main/sync/github/github-client.js', () => ({ GitHubClient: vi.fn() }));
vi.mock('@main/sync/github/commits-source.js', () => ({ GitHubCommitsSource: vi.fn() }));
vi.mock('@main/sync/github/prs-source.js', () => ({ GitHubPrsSource: vi.fn() }));
vi.mock('@main/sync/github/reviews-source.js', () => ({ GitHubReviewsSource: vi.fn() }));

vi.mock('@main/activity/index.js', () => ({
  initActivityMonitoring: async () => {
    constructed.activityInits += 1;
  },
  stopActivityMonitoring: () => undefined,
}));

describe('app startup', () => {
  beforeEach(() => {
    constructed.gdocsPoller = 0;
    constructed.sourcePoller = 0;
    constructed.activityInits = 0;
    vi.resetModules();
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('starts no context connector pollers, even for a profile connected to Google and GitHub', async () => {
    const { settingsRepo } = await import('@main/store/index.js');
    settingsRepo.update({
      googleConnected: true,
      githubConnected: true,
      gmailEnabled: true,
      calendarEnabled: true,
      classroomEnabled: true,
      githubTrackingEnabled: true,
      gdocsPollingEnabled: true,
    });

    await import('@main/index.js');
    await vi.waitFor(() => expect(constructed.activityInits).toBe(1));

    expect(constructed.gdocsPoller).toBe(0);
    expect(constructed.sourcePoller).toBe(0);
  });
});
