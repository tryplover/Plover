import { GitHubClient } from './github-client.js';
import { SettingsRepo, SettingsData } from '../../store/repos/settings.js';
import { TypedEventBus } from '../../events/bus.js';
import { ContextSource } from '../source-poller.js';
import { GitHubReviewPayload } from '../../../shared/events.js';

interface GitHubSearchIssueEntry {
  repository_url: string;
  number: number;
  html_url: string;
  updated_at: string;
}

interface GitHubNotificationEntry {
  reason: string;
  subject?: { type?: string; url?: string } | null;
  repository?: { full_name?: string } | null;
  updated_at: string;
}

function repoFromRepositoryUrl(repositoryUrl: string): string {
  const segments = repositoryUrl.split('/');
  return segments.slice(-2).join('/');
}

function prNumberFromSubjectUrl(subjectUrl: string): number {
  const match = /\/(\d+)$/.exec(subjectUrl);
  return match ? Number(match[1]) : NaN;
}

const REASON_TO_KIND: Record<string, GitHubReviewPayload['kind']> = {
  review_requested: 'requested',
  mention: 'mentioned',
  comment: 'commented',
};

export class GitHubReviewsSource implements ContextSource {
  readonly provider = 'github';
  readonly source = 'reviews';

  constructor(
    private client: GitHubClient,
    private settingsRepo: SettingsRepo,
    private eventBus: TypedEventBus,
  ) {}

  enabled(settings: SettingsData): boolean {
    return settings.githubConnected && settings.githubTrackingEnabled;
  }

  async poll(cursor: string | null): Promise<string> {
    if (cursor === null) {
      return new Date().toISOString();
    }

    const seen = new Set<string>();
    let maxUpdatedAt = cursor;

    const emitReview = (payload: GitHubReviewPayload): void => {
      if (payload.updatedAt > maxUpdatedAt) {
        maxUpdatedAt = payload.updatedAt;
      }

      if (payload.updatedAt <= cursor) return;

      const dedupeKey = `${payload.repo}#${payload.prNumber}:${payload.kind}@${payload.updatedAt}`;
      if (seen.has(dedupeKey)) return;
      seen.add(dedupeKey);
      this.eventBus.emit('github.review', payload);
    };

    const searchQuery = `is:pr review-requested:@me updated:>=${cursor}`;
    const searchResponse = await this.client.request(
      `/search/issues?q=${encodeURIComponent(searchQuery)}&per_page=50`,
    );
    const searchData = searchResponse.data as { items?: unknown } | null;
    const items = Array.isArray(searchData?.items)
      ? (searchData?.items as GitHubSearchIssueEntry[])
      : [];

    for (const item of items) {
      emitReview({
        repo: repoFromRepositoryUrl(item.repository_url),
        prNumber: item.number,
        kind: 'requested',
        url: item.html_url,
        updatedAt: item.updated_at,
      });
    }

    const notificationsResponse = await this.client.request(
      `/notifications?all=false&since=${encodeURIComponent(cursor)}`,
    );
    const notifications = Array.isArray(notificationsResponse.data)
      ? (notificationsResponse.data as GitHubNotificationEntry[])
      : [];

    for (const notification of notifications) {
      if (notification.subject?.type !== 'PullRequest') continue;
      const kind = REASON_TO_KIND[notification.reason];
      if (!kind) continue;
      const subjectUrl = notification.subject.url ?? '';
      const repo = notification.repository?.full_name;
      if (!repo) continue;

      emitReview({
        repo,
        prNumber: prNumberFromSubjectUrl(subjectUrl),
        kind,
        url: subjectUrl,
        updatedAt: notification.updated_at,
      });
    }

    return maxUpdatedAt;
  }
}
