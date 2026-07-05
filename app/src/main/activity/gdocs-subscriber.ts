import { ActivityRepo } from '../store/repos/activity.js';
import { SettingsRepo } from '../store/repos/settings.js';
import { TypedEventBus } from '../bus.js';
import { GDocsRevisionPayload } from '../../shared/events.js';

export class GDocsActivitySubscriber {
  private activityRepo: ActivityRepo;
  private settingsRepo: SettingsRepo;
  private eventBus: TypedEventBus;
  private onGDocsRevisionHandler: ((payload: GDocsRevisionPayload) => void) | null = null;

  constructor(activityRepo: ActivityRepo, settingsRepo: SettingsRepo, eventBus: TypedEventBus) {
    this.activityRepo = activityRepo;
    this.settingsRepo = settingsRepo;
    this.eventBus = eventBus;
  }

  start(): void {
    this.onGDocsRevisionHandler = (payload: GDocsRevisionPayload) => {
      const settings = this.settingsRepo.getAll();
      if (settings.pauseAllTracking || !settings.gdocsPollingEnabled) {
        return;
      }

      this.activityRepo.log('gdocs_revision', {
        fileId: payload.fileId,
        name: payload.name,
        modifiedTime: payload.modifiedTime,
      });
    };
    this.eventBus.on('gdocs.revision', this.onGDocsRevisionHandler);
  }

  stop(): void {
    if (this.onGDocsRevisionHandler) {
      this.eventBus.off('gdocs.revision', this.onGDocsRevisionHandler);
      this.onGDocsRevisionHandler = null;
    }
  }
}
