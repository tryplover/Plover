import { ActivityRepo } from '../../../../store/repos/activity.js';
import { SettingsRepo } from '../../../../store/repos/settings.js';
import { TypedEventBus } from '../../../../events/bus.js';
import { GmailMessagePayload } from '../../../../../shared/events.js';
import { gate } from '../../../shared/gate.js';

export class GmailActivitySubscriber {
  constructor(
    private activityRepo: ActivityRepo,
    private settingsRepo: SettingsRepo,
    private eventBus: TypedEventBus,
  ) {}

  start(): void {
    this.eventBus.on('gmail.message', this.handle);
  }

  stop(): void {
    this.eventBus.off('gmail.message', this.handle);
  }

  private handle = (payload: GmailMessagePayload): void => {
    if (!gate(this.settingsRepo, 'gmailEnabled')) return;
    this.activityRepo.log('gmail_message', { ...payload });
  };
}
