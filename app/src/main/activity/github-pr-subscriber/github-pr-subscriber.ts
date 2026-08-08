import { ActivityRepo } from '../../store/repos/activity.js';
import { SettingsRepo } from '../../store/repos/settings.js';
import { TypedEventBus } from '../../events/bus.js';
import { GitHubPrPayload } from '../../../shared/events.js';
import { gate } from '../shared/gate.js';

export class GitHubPrActivitySubscriber {
  constructor(
    private activityRepo: ActivityRepo,
    private settingsRepo: SettingsRepo,
    private eventBus: TypedEventBus,
  ) {}

  start(): void {
    this.eventBus.on('github.pr', this.handle);
  }

  stop(): void {
    this.eventBus.off('github.pr', this.handle);
  }

  private handle = (payload: GitHubPrPayload): void => {
    if (!gate(this.settingsRepo, 'githubTrackingEnabled')) return;
    this.activityRepo.log('github_pr', { ...payload });
  };
}
