import { ActivityRepo } from '@main/store/repos/activity.js';
import { SettingsRepo } from '@main/store/repos/settings.js';
import { TypedEventBus } from '@main/events/bus.js';
import { CalendarEventPayload } from '@shared/events.js';
import { gate } from '@main/activity/shared/gate.js';

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
