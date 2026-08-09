import { ActivityRepo } from '../../../../store/repos/activity.js';
import { SettingsRepo } from '../../../../store/repos/settings.js';
import { TypedEventBus } from '../../../../events/bus.js';
import { CalendarEventPayload } from '../../../../../shared/events.js';
import { gate } from '../../../shared/gate.js';

export class CalendarActivitySubscriber {
  constructor(
    private activityRepo: ActivityRepo,
    private settingsRepo: SettingsRepo,
    private eventBus: TypedEventBus,
  ) {}

  start(): void {
    this.eventBus.on('calendar.event', this.handle);
  }

  stop(): void {
    this.eventBus.off('calendar.event', this.handle);
  }

  private handle = (payload: CalendarEventPayload): void => {
    if (!gate(this.settingsRepo, 'calendarEnabled')) return;
    this.activityRepo.log('calendar_event', { ...payload });
  };
}
