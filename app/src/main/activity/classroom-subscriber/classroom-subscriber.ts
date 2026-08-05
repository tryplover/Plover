import { ActivityRepo } from '../../store/repos/activity.js';
import { SettingsRepo } from '../../store/repos/settings.js';
import { TypedEventBus } from '../../events/bus.js';
import { ClassroomCourseworkPayload } from '../../../shared/events.js';
import { gate } from '../shared/gate.js';

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
