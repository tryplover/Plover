import { ActivityRepo } from '../store/repos/activity.js';
import { SettingsRepo } from '../store/repos/settings.js';
import { TypedEventBus } from '../events/bus.js';
import { GDocsRevisionPayload } from '../../shared/events.js';
import { gate } from './shared/gate.js';

export class GDocsActivitySubscriber {
  constructor(
    private activityRepo: ActivityRepo,
    private settingsRepo: SettingsRepo,
    private eventBus: TypedEventBus,
  ) {}

  start(): void {
    this.eventBus.on('gdocs.revision', this.handleRevision);
  }

  stop(): void {
    this.eventBus.off('gdocs.revision', this.handleRevision);
  }

  private handleRevision = (payload: GDocsRevisionPayload): void => {
    if (!gate(this.settingsRepo, 'gdocsPollingEnabled')) return;
    this.activityRepo.log('gdocs_revision', {
      fileId: payload.fileId,
      name: payload.name,
      modifiedTime: payload.modifiedTime,
    });
  };
}
