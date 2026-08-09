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
import { ClassroomActivitySubscriber } from '../../src/main/activity/sources/google/classroom-subscriber/classroom-subscriber';

describe('ClassroomActivitySubscriber', () => {
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

  it('writes a classroom_coursework activity row on classroom.coursework when enabled', () => {
    settings.update({ classroomEnabled: true, pauseAllTracking: false });
    new ClassroomActivitySubscriber(activity, settings, bus).start();
    bus.emit('classroom.coursework', {
      courseId: 'c1',
      courseName: 'Math',
      id: 'w1',
      title: 'Homework 1',
      dueDate: '2026-08-10',
      state: 'PUBLISHED',
    });
    const rows = activity.list({ kind: 'classroom_coursework' });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.payload).toMatchObject({
      courseId: 'c1',
      courseName: 'Math',
      id: 'w1',
      title: 'Homework 1',
    });
  });

  it('does not write when pauseAllTracking is set', () => {
    settings.update({ classroomEnabled: true, pauseAllTracking: true });
    new ClassroomActivitySubscriber(activity, settings, bus).start();
    bus.emit('classroom.coursework', {
      courseId: 'c1',
      courseName: 'Math',
      id: 'w1',
      title: 'Homework 1',
      dueDate: '2026-08-10',
      state: 'PUBLISHED',
    });
    expect(activity.list({ kind: 'classroom_coursework' })).toHaveLength(0);
  });
});
