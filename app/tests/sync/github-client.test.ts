import { describe, expect, it, beforeEach, vi } from 'vitest';
import { GitHubClient } from '../../src/main/sync/github/github-client';

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

function res(status: number, body: unknown, headers: Record<string, string> = {}) {
  return {
    status,
    headers: { get: (h: string) => headers[h.toLowerCase()] ?? null },
    json: async () => body,
  };
}

describe('GitHubClient', () => {
  beforeEach(() => fetchMock.mockReset());

  it('sends auth + version headers and returns parsed data + etag', async () => {
    fetchMock.mockResolvedValueOnce(res(200, [{ sha: 'abc' }], { etag: 'W/"e1"' }));
    const c = new GitHubClient({ token: 'gho_x' });
    const r = await c.request('/repos/o/r/commits?since=2026-01-01T00:00:00Z');
    const [url, init] = fetchMock.mock.calls[0] as [string, { headers: Record<string, string> }];
    expect(url).toBe('https://api.github.com/repos/o/r/commits?since=2026-01-01T00:00:00Z');
    expect(init.headers.Authorization).toBe('Bearer gho_x');
    expect(r).toEqual({ status: 200, etag: 'W/"e1"', data: [{ sha: 'abc' }] });
  });

  it('returns status 304 with null data on Not-Modified and forwards If-None-Match', async () => {
    fetchMock.mockResolvedValueOnce(res(304, null, { etag: 'W/"e1"' }));
    const c = new GitHubClient({ token: 'gho_x' });
    const r = await c.request('/x', { etag: 'W/"e1"' });
    const [, init] = fetchMock.mock.calls[0] as [string, { headers: Record<string, string> }];
    expect(init.headers['If-None-Match']).toBe('W/"e1"');
    expect(r.status).toBe(304);
    expect(r.data).toBeNull();
  });

  it('throws RateLimitError on 403 with zero remaining', async () => {
    fetchMock.mockResolvedValueOnce(
      res(403, {}, { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': '1700000000' }),
    );
    const c = new GitHubClient({ token: 'gho_x' });
    await expect(c.request('/x')).rejects.toThrow(/rate limit/i);
  });
});
