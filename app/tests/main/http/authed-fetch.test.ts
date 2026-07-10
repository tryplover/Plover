import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { authedFetch, UnauthorizedError } from '../../../src/main/http/authed-fetch';

const { mockGetPloverToken, mockClearPloverToken } = vi.hoisted(() => ({
  mockGetPloverToken: vi.fn(),
  mockClearPloverToken: vi.fn(),
}));

vi.mock('../../../src/main/auth/plover-token.js', () => ({
  getPloverToken: mockGetPloverToken,
  clearPloverToken: mockClearPloverToken,
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

  it('throws UnauthorizedError before fetching when no token is present', async () => {
    mockGetPloverToken.mockResolvedValueOnce(null);
    await expect(authedFetch('/api/decompose')).rejects.toBeInstanceOf(UnauthorizedError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('attaches X-Plover-Auth-Token header and returns response on 200', async () => {
    mockGetPloverToken.mockResolvedValueOnce('token-abc');
    const okRes = new Response('{"ok":true}', { status: 200 });
    fetchMock.mockResolvedValueOnce(okRes);

    const res = await authedFetch('/api/decompose', { method: 'POST' });

    expect(res).toBe(okRes);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [urlArg, initArg] = fetchMock.mock.calls[0] ?? [];
    expect(urlArg).toBe('http://localhost:3000/api/decompose');
    const headers = (initArg as RequestInit).headers as Headers;
    expect(headers.get('X-Plover-Auth-Token')).toBe('token-abc');
    expect((initArg as RequestInit).method).toBe('POST');
  });

  it('clears the plover token and throws UnauthorizedError on 401', async () => {
    mockGetPloverToken.mockResolvedValueOnce('bad-token');
    mockClearPloverToken.mockResolvedValueOnce(undefined);
    fetchMock.mockResolvedValueOnce(new Response('unauthorized', { status: 401 }));

    await expect(authedFetch('/api/decompose')).rejects.toBeInstanceOf(UnauthorizedError);
    expect(mockClearPloverToken).toHaveBeenCalledTimes(1);
  });

  it('returns response on 500 without throwing', async () => {
    mockGetPloverToken.mockResolvedValueOnce('token-abc');
    const errRes = new Response('server error', { status: 500 });
    fetchMock.mockResolvedValueOnce(errRes);

    const res = await authedFetch('/api/decompose');
    expect(res).toBe(errRes);
    expect(res.status).toBe(500);
    expect(mockClearPloverToken).not.toHaveBeenCalled();
  });

  it('does not double up slashes when joining relative paths', async () => {
    mockGetPloverToken.mockResolvedValueOnce('token-abc');
    fetchMock.mockResolvedValueOnce(new Response('{}', { status: 200 }));

    await authedFetch('api/infer-progress');

    const [urlArg] = fetchMock.mock.calls[0] ?? [];
    expect(urlArg).toBe('http://localhost:3000/api/infer-progress');
  });

  it('joins a leading-slash path against the backend URL with a single slash', async () => {
    mockGetPloverToken.mockResolvedValueOnce('token-abc');
    fetchMock.mockResolvedValueOnce(new Response('{}', { status: 200 }));

    await authedFetch('/api/match-commit');

    const [urlArg] = fetchMock.mock.calls[0] ?? [];
    expect(urlArg).toBe('http://localhost:3000/api/match-commit');
  });

  it('passes through absolute URLs unchanged', async () => {
    mockGetPloverToken.mockResolvedValueOnce('token-abc');
    fetchMock.mockResolvedValueOnce(new Response('{}', { status: 200 }));

    await authedFetch('https://example.com/api/thing');

    const [urlArg] = fetchMock.mock.calls[0] ?? [];
    expect(urlArg).toBe('https://example.com/api/thing');
  });

  it('strips a trailing slash from the backend URL', async () => {
    process.env.PLOVER_BACKEND_URL = 'http://localhost:3000/';
    mockGetPloverToken.mockResolvedValueOnce('token-abc');
    fetchMock.mockResolvedValueOnce(new Response('{}', { status: 200 }));

    await authedFetch('/api/decompose');

    const [urlArg] = fetchMock.mock.calls[0] ?? [];
    expect(urlArg).toBe('http://localhost:3000/api/decompose');
  });
});
