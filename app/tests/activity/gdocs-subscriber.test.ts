import { describe, expect, it, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { runMigrations } from '../../src/main/store/db';
import { ActivityRepo } from '../../src/main/store/repos/activity';
import { SettingsRepo } from '../../src/main/store/repos/settings';
import { TypedEventBus } from '../../src/main/bus';
import { GDocsActivitySubscriber } from '../../src/main/activity/gdocs-subscriber';

describe('GDocsActivitySubscriber', () => {
  let db: Database.Database;
  let activityRepo: ActivityRepo;
  let settingsRepo: SettingsRepo;
  let eventBus: TypedEventBus;
  let subscriber: GDocsActivitySubscriber;

  beforeEach(() => {
    db = new Database(':memory:');
    runMigrations(db);
    activityRepo = new ActivityRepo(db);
    settingsRepo = new SettingsRepo(db);
    eventBus = new TypedEventBus();
    subscriber = new GDocsActivitySubscriber(activityRepo, settingsRepo, eventBus);
  });

  it('should log an activity when gdocs.revision event is emitted', () => {
    subscriber.start();

    const payload = {
      fileId: 'test-file-id',
      name: 'Test Doc',
      modifiedTime: new Date().toISOString(),
    };

    eventBus.emit('gdocs.revision', payload);

    const activities = activityRepo.list({ kind: 'gdocs_revision' });
    expect(activities).toHaveLength(1);
    expect(activities[0]?.payload).toEqual(payload);
  });

  it('should not log activity if gdocsPollingEnabled is false', () => {
    settingsRepo.update({ gdocsPollingEnabled: false });
    subscriber.start();

    const payload = {
      fileId: 'test-file-id',
      name: 'Test Doc',
      modifiedTime: new Date().toISOString(),
    };

    eventBus.emit('gdocs.revision', payload);

    const activities = activityRepo.list({ kind: 'gdocs_revision' });
    expect(activities).toHaveLength(0);
  });

  it('should not log activity if pauseAllTracking is true', () => {
    settingsRepo.update({ pauseAllTracking: true });
    subscriber.start();

    const payload = {
      fileId: 'test-file-id',
      name: 'Test Doc',
      modifiedTime: new Date().toISOString(),
    };

    eventBus.emit('gdocs.revision', payload);

    const activities = activityRepo.list({ kind: 'gdocs_revision' });
    expect(activities).toHaveLength(0);
  });

  it('should stop listening when stop() is called', () => {
    subscriber.start();
    subscriber.stop();

    const payload = {
      fileId: 'test-file-id',
      name: 'Test Doc',
      modifiedTime: new Date().toISOString(),
    };

    eventBus.emit('gdocs.revision', payload);

    const activities = activityRepo.list({ kind: 'gdocs_revision' });
    expect(activities).toHaveLength(0);
  });
});
