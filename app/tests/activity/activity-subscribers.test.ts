import { describe, expect, it, beforeEach, vi } from 'vitest';

vi.mock('keytar');
vi.mock('electron', () => ({ app: { getPath: vi.fn(() => '/test') } }));

import Database from 'better-sqlite3';
import { runMigrations } from '../../src/main/store/db';
import { ActivityRepo } from '../../src/main/store/repos/activity';
import { SettingsRepo } from '../../src/main/store/repos/settings';
import { TypedEventBus } from '../../src/main/events/bus';
import type { EventPayloads } from '../../src/shared/events';
import { createActivitySubscribers } from '../../src/main/activity/sources/activity-subscriber';
import { GOOGLE_SUBSCRIBER_SPECS } from '../../src/main/activity/sources/google/subscribers';
import { GITHUB_SUBSCRIBER_SPECS } from '../../src/main/activity/sources/github/subscribers';

const SAMPLE_PAYLOADS: { [E in keyof EventPayloads]?: EventPayloads[E] } = {
  'gmail.message': {
    id: 'm1',
    threadId: 't1',
    from: 'a@b.com',
    subject: 'Hi',
    snippet: 's',
    labels: ['INBOX'],
    receivedAt: '2026-08-04T00:00:00.000Z',
  },
  'calendar.event': {
    id: 'c1',
    title: 'Standup',
    start: '2026-08-04T09:00:00.000Z',
    end: '2026-08-04T09:15:00.000Z',
    status: 'confirmed',
    attendeeCount: 3,
    location: null,
  },
  'classroom.coursework': {
    courseId: 'co1',
    courseName: 'Math',
    id: 'cw1',
    title: 'HW1',
    dueDate: null,
    state: 'PUBLISHED',
  },
  'gdocs.revision': {
    fileId: 'f1',
    name: 'Doc',
    modifiedTime: '2026-08-04T00:00:00.000Z',
    revisionId: 'r1',
  },
  'github.commit': {
    repo: 'o/r',
    sha: 'abc',
    message: 'msg',
    author: 'me',
    url: 'https://x',
    committedAt: '2026-08-04T00:00:00.000Z',
  },
  'github.pr': {
    repo: 'o/r',
    number: 1,
    title: 'PR',
    state: 'open',
    action: 'opened',
    url: 'https://x',
    updatedAt: '2026-08-04T00:00:00.000Z',
  },
  'github.review': {
    repo: 'o/r',
    prNumber: 1,
    kind: 'reviewed',
    url: 'https://x',
    updatedAt: '2026-08-04T00:00:00.000Z',
  },
};

const ALL_SPECS = [...GOOGLE_SUBSCRIBER_SPECS, ...GITHUB_SUBSCRIBER_SPECS];

const CASES = ALL_SPECS.map((spec) => {
  const payload = SAMPLE_PAYLOADS[spec.event];
  if (!payload) throw new Error(`missing SAMPLE_PAYLOADS for ${spec.event}`);
  return { spec, payload };
});

describe('activity bus subscribers', () => {
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

  it('has a sample payload for every registered spec', () => {
    expect(CASES).toHaveLength(ALL_SPECS.length);
  });

  for (const { spec, payload } of CASES) {
    it(`logs ${spec.kind} on ${spec.event} when enabled`, () => {
      settings.update({ [spec.gate]: true, pauseAllTracking: false } as Record<string, boolean>);
      const group = createActivitySubscribers([spec], {
        activityRepo: activity,
        settingsRepo: settings,
        eventBus: bus,
      });
      group.start();
      bus.emit(spec.event, payload);
      expect(activity.list({ kind: spec.kind })).toHaveLength(1);
    });

    it(`suppresses ${spec.kind} when its gate is off`, () => {
      settings.update({ [spec.gate]: false, pauseAllTracking: false } as Record<string, boolean>);
      const group = createActivitySubscribers([spec], {
        activityRepo: activity,
        settingsRepo: settings,
        eventBus: bus,
      });
      group.start();
      bus.emit(spec.event, payload);
      expect(activity.list({ kind: spec.kind })).toHaveLength(0);
    });

    it(`suppresses ${spec.kind} when pauseAllTracking is set`, () => {
      settings.update({ [spec.gate]: true, pauseAllTracking: true } as Record<string, boolean>);
      const group = createActivitySubscribers([spec], {
        activityRepo: activity,
        settingsRepo: settings,
        eventBus: bus,
      });
      group.start();
      bus.emit(spec.event, payload);
      expect(activity.list({ kind: spec.kind })).toHaveLength(0);
    });
  }

  it('stop() unsubscribes so later emits are ignored', () => {
    const [first] = CASES;
    if (!first) throw new Error('no specs registered');
    settings.update({ [first.spec.gate]: true, pauseAllTracking: false } as Record<string, boolean>);
    const group = createActivitySubscribers([first.spec], {
      activityRepo: activity,
      settingsRepo: settings,
      eventBus: bus,
    });
    group.start();
    group.stop();
    bus.emit(first.spec.event, first.payload);
    expect(activity.list({ kind: first.spec.kind })).toHaveLength(0);
  });
});
