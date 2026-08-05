import { ActivityRepo } from '../../store/repos/activity.js';
import { SettingsRepo } from '../../store/repos/settings.js';
import { TypedEventBus } from '../../events/bus.js';
import { GitHubReviewPayload } from '../../../shared/events.js';
import { gate } from '../shared/gate.js';

export class GitHubReviewActivitySubscriber {
  constructor(
    private activityRepo: ActivityRepo,
    private settingsRepo: SettingsRepo,
    private eventBus: TypedEventBus,
  ) {}

  start(): void {
    this.eventBus.on('github.review', this.handle);
  }

  stop(): void {
    this.eventBus.off('github.review', this.handle);
  }

  private handle = (payload: GitHubReviewPayload): void => {
    if (!gate(this.settingsRepo, 'githubTrackingEnabled')) return;
    this.activityRepo.log('github_review', { ...payload });
  };
}
