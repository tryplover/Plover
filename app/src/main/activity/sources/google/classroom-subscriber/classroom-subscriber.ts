import { ActivityRepo } from '@main/store/repos/activity.js';
import { SettingsRepo } from '@main/store/repos/settings.js';
import { TypedEventBus } from '@main/events/bus.js';
import { ClassroomCourseworkPayload } from '@shared/events.js';
import { gate } from '@main/activity/shared/gate.js';

export class ClassroomActivitySubscriber {
  constructor(
    private activityRepo: ActivityRepo,
    private settingsRepo: SettingsRepo,
    private eventBus: TypedEventBus,
  ) {}

  start(): void {
    this.eventBus.on('classroom.coursework', this.handle);
  }

  stop(): void {
    this.eventBus.off('classroom.coursework', this.handle);
  }

  private handle = (payload: ClassroomCourseworkPayload): void => {
    if (!gate(this.settingsRepo, 'classroomEnabled')) return;
    this.activityRepo.log('classroom_coursework', { ...payload });
  };
}
