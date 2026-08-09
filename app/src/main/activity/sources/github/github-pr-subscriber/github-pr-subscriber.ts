import { ActivityRepo } from '@main/store/repos/activity.js';
import { SettingsRepo } from '@main/store/repos/settings.js';
import { TypedEventBus } from '@main/events/bus.js';
import { GitHubPrPayload } from '@shared/events.js';
import { gate } from '@main/activity/shared/gate.js';

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
