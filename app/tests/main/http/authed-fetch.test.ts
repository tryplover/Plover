import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { authedFetch, UnauthorizedError } from '../../../src/main/http/authed-fetch';

const { mockGetAccessToken } = vi.hoisted(() => ({
  mockGetAccessToken: vi.fn(),
}));

vi.mock('../../../src/main/auth/supabase-auth.js', () => ({
  getAccessToken: mockGetAccessToken,
}));

describe('authedFetch', () => {
  const originalBackendEnv = process.env.PLOVER_BACKEND_URL;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.PLOVER_BACKEND_URL = 'http://localhost:3000';
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    if (originalBackendEnv === undefined) {
      delete process.env.PLOVER_BACKEND_URL;
    } else {
      process.env.PLOVER_BACKEND_URL = originalBackendEnv;
    }
  });

  it('throws UnauthorizedError before fetching when there is no Supabase session', async () => {
    mockGetAccessToken.mockResolvedValueOnce(null);
    await expect(authedFetch('/api/decompose')).rejects.toBeInstanceOf(UnauthorizedError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('attaches an Authorization bearer header and returns response on 200', async () => {
    mockGetAccessToken.mockResolvedValueOnce('token-abc');
    const okRes = new Response('{"ok":true}', { status: 200 });
    fetchMock.mockResolvedValueOnce(okRes);

    const res = await authedFetch('/api/decompose', { method: 'POST' });

    expect(res).toBe(okRes);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [urlArg, initArg] = fetchMock.mock.calls[0] ?? [];
    expect(urlArg).toBe('http://localhost:3000/api/decompose');
    const headers = (initArg as RequestInit).headers as Headers;
    expect(headers.get('Authorization')).toBe('Bearer token-abc');
    expect((initArg as RequestInit).method).toBe('POST');
  });

  it('throws UnauthorizedError on 401 without touching the local session', async () => {
    mockGetAccessToken.mockResolvedValueOnce('bad-token');
    fetchMock.mockResolvedValueOnce(new Response('unauthorized', { status: 401 }));

    await expect(authedFetch('/api/decompose')).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it('returns response on 500 without throwing', async () => {
    mockGetAccessToken.mockResolvedValueOnce('token-abc');
    const errRes = new Response('server error', { status: 500 });
    fetchMock.mockResolvedValueOnce(errRes);

    const res = await authedFetch('/api/decompose');
    expect(res).toBe(errRes);
    expect(res.status).toBe(500);
  });

  it('does not double up slashes when joining relative paths', async () => {
    mockGetAccessToken.mockResolvedValueOnce('token-abc');
    fetchMock.mockResolvedValueOnce(new Response('{}', { status: 200 }));

    await authedFetch('api/infer-progress');

    const [urlArg] = fetchMock.mock.calls[0] ?? [];
    expect(urlArg).toBe('http://localhost:3000/api/infer-progress');
  });

  it('joins a leading-slash path against the backend URL with a single slash', async () => {
    mockGetAccessToken.mockResolvedValueOnce('token-abc');
    fetchMock.mockResolvedValueOnce(new Response('{}', { status: 200 }));

    await authedFetch('/api/match-commit');

    const [urlArg] = fetchMock.mock.calls[0] ?? [];
    expect(urlArg).toBe('http://localhost:3000/api/match-commit');
  });

  it('passes through absolute URLs to allowlisted hosts unchanged', async () => {
    mockGetAccessToken.mockResolvedValueOnce('token-abc');
    fetchMock.mockResolvedValueOnce(new Response('{}', { status: 200 }));

    await authedFetch('https://www.googleapis.com/drive/v3/files');

    const [urlArg] = fetchMock.mock.calls[0] ?? [];
    expect(urlArg).toBe('https://www.googleapis.com/drive/v3/files');
  });

  it('blocks an absolute URL to a non-allowlisted host before fetching', async () => {
    mockGetAccessToken.mockResolvedValueOnce('token-abc');

    await expect(authedFetch('https://evil.example.com/exfil')).rejects.toThrow(
      /Outbound host not allowed/,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('allows the runtime-resolved backend host even though it is not in ALLOWED_HOSTS', async () => {
    process.env.PLOVER_BACKEND_URL = 'https://plover-backend.example.run.app';
    mockGetAccessToken.mockResolvedValueOnce('token-abc');
    fetchMock.mockResolvedValueOnce(new Response('{}', { status: 200 }));

    await authedFetch('/api/decompose');

    const [urlArg] = fetchMock.mock.calls[0] ?? [];
    expect(urlArg).toBe('https://plover-backend.example.run.app/api/decompose');
  });

  it('strips a trailing slash from the backend URL', async () => {
    process.env.PLOVER_BACKEND_URL = 'http://localhost:3000/';
    mockGetAccessToken.mockResolvedValueOnce('token-abc');
    fetchMock.mockResolvedValueOnce(new Response('{}', { status: 200 }));

    await authedFetch('/api/decompose');

    const [urlArg] = fetchMock.mock.calls[0] ?? [];
    expect(urlArg).toBe('http://localhost:3000/api/decompose');
  });
});
