import { GitHubClient } from './github-client.js';
import { SettingsRepo, SettingsData } from '../../store/repos/settings.js';
import { TypedEventBus } from '../../events/bus.js';
import { ContextSource } from '../source-poller.js';

interface GitHubSearchIssueEntry {
  repository_url: string;
  number: number;
  title: string;
  state: string;
  html_url: string;
  updated_at: string;
  pull_request?: { merged_at?: string | null } | null;
}

function repoFromRepositoryUrl(repositoryUrl: string): string {
  const segments = repositoryUrl.split('/');
  return segments.slice(-2).join('/');
}

export class GitHubPrsSource implements ContextSource {
  readonly provider = 'github';
  readonly source = 'prs';

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

    const query = `is:pr involves:@me updated:>=${cursor}`;
    const response = await this.client.request(
      `/search/issues?q=${encodeURIComponent(query)}&sort=updated&order=asc&per_page=50`,
    );
    const data = response.data as { items?: unknown } | null;
    const items = Array.isArray(data?.items) ? (data?.items as GitHubSearchIssueEntry[]) : [];

    const seen = new Set<string>();
    let maxUpdatedAt = cursor;
    for (const item of items) {
      if (item.updated_at > maxUpdatedAt) {
        maxUpdatedAt = item.updated_at;
      }

      if (item.updated_at <= cursor) continue;

      const repo = repoFromRepositoryUrl(item.repository_url);
      const dedupeKey = `${repo}#${item.number}@${item.updated_at}`;
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);

      const action = item.pull_request?.merged_at
        ? 'merged'
        : item.state === 'closed'
          ? 'closed'
          : 'updated';

      this.eventBus.emit('github.pr', {
        repo,
        number: item.number,
        title: item.title,
        state: item.state,
        action,
        url: item.html_url,
        updatedAt: item.updated_at,
      });
    }

    return maxUpdatedAt;
  }
}
