import { GitHubClient } from './github-client.js';
import { SettingsRepo, SettingsData } from '../../store/repos/settings.js';
import { TypedEventBus } from '../../events/bus.js';
import { ContextSource } from '../source-poller.js';

interface GitHubCommitApiEntry {
  sha: string;
  html_url: string;
  author?: { login?: string } | null;
  commit: {
    message: string;
    author: { name: string; date: string };
  };
}

export class GitHubCommitsSource implements ContextSource {
  readonly provider = 'github';
  readonly source = 'commits';

  constructor(
    private client: GitHubClient,
    private settingsRepo: SettingsRepo,
    private eventBus: TypedEventBus,
  ) {}

  enabled(settings: SettingsData): boolean {
    return settings.githubConnected && settings.githubTrackingEnabled && settings.githubWatchedRepos.length > 0;
  }

  async poll(cursor: string | null): Promise<string> {
    const { githubWatchedRepos } = this.settingsRepo.getAll();

    if (cursor === null) {
      const map: Record<string, string> = {};
      const now = new Date().toISOString();
      for (const repo of githubWatchedRepos) {
        map[repo] = now;
      }
      return JSON.stringify(map);
    }

    const map = JSON.parse(cursor) as Record<string, string>;

    for (const repo of githubWatchedRepos) {
      const since = map[repo] ?? new Date().toISOString();
      const response = await this.client.request(`/repos/${repo}/commits?since=${encodeURIComponent(since)}`);
      const commits = Array.isArray(response.data) ? (response.data as GitHubCommitApiEntry[]) : [];

      const seen = new Set<string>();
      let maxCommittedAt = since;
      for (const c of commits) {
        if (seen.has(c.sha)) continue;
        seen.add(c.sha);
        const committedAt = c.commit.author.date;
        if (committedAt <= since) continue;
        this.eventBus.emit('github.commit', {
          repo,
          sha: c.sha,
          message: c.commit.message,
          author: c.author?.login ?? c.commit.author.name,
          url: c.html_url,
          committedAt,
        });
        if (committedAt > maxCommittedAt) {
          maxCommittedAt = committedAt;
        }
      }

      map[repo] = maxCommittedAt;
    }

    return JSON.stringify(map);
  }
}
