import { assertAllowedHost } from '../../http/allowlist.js';

export class RateLimitError extends Error {
  resetEpoch: number;

  constructor(resetEpoch: number) {
    super(`GitHub rate limit exceeded, resets at ${resetEpoch}`);
    this.name = 'RateLimitError';
    this.resetEpoch = resetEpoch;
  }
}

export interface GitHubRequestOptions {
  etag?: string;
}

export interface GitHubResponse {
  status: number;
  etag: string | null;
  data: unknown;
}

export class GitHubClient {
  constructor(private readonly auth: { token: string | null }) {}

  async request(path: string, opts?: GitHubRequestOptions): Promise<GitHubResponse> {
    const url = path.startsWith('http') ? path : `https://api.github.com${path}`;
    assertAllowedHost(url);

    const headers: Record<string, string> = {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    };

    const token = this.auth.token;
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    if (opts?.etag) {
      headers['If-None-Match'] = opts.etag;
    }

    const response = await fetch(url, { headers });

    if (response.status === 403 && response.headers.get('x-ratelimit-remaining') === '0') {
      const reset = Number(response.headers.get('x-ratelimit-reset'));
      throw new RateLimitError(reset);
    }

    if (response.status === 304) {
      return { status: 304, etag: response.headers.get('etag'), data: null };
    }

    return { status: response.status, etag: response.headers.get('etag'), data: await response.json() };
  }
}
