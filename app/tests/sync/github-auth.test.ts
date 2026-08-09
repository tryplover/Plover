import { describe, expect, it, beforeEach, vi } from 'vitest';
import { GitHubAuth } from '../../src/main/sync/github-auth';

const { mockKeychain, mockOpenExternal } = vi.hoisted(() => {
  return {
    mockKeychain: new Map<string, string>(),
    mockOpenExternal: vi.fn().mockResolvedValue(true),
  };
});

vi.mock('keytar', () => ({
  default: {
    getPassword: vi.fn(async (service: string, account: string) => {
      return mockKeychain.get(`${service}:${account}`) || null;
    }),
    setPassword: vi.fn(async (service: string, account: string, secret: string) => {
      mockKeychain.set(`${service}:${account}`, secret);
    }),
    deletePassword: vi.fn(async (service: string, account: string) => {
      mockKeychain.delete(`${service}:${account}`);
      return true;
    }),
  },
}));

vi.mock('electron', () => ({
  shell: {
    openExternal: mockOpenExternal,
  },
  app: { isPackaged: false },
}));

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

describe('GitHubAuth device flow', () => {
  beforeEach(() => {
    mockKeychain.clear();
    fetchMock.mockReset();
    mockOpenExternal.mockClear();
  });

  it('runs device flow, stores the token, and reports authorized', async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          device_code: 'dc',
          user_code: 'ABCD-1234',
          verification_uri: 'https://github.com/login/device',
          interval: 0,
          expires_in: 900,
        }),
      })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ error: 'authorization_pending' }) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'gho_test', token_type: 'bearer', scope: 'repo,read:user' }),
      });

    const auth = new GitHubAuth();
    await auth.authorizeDeviceFlow();

    expect(await auth.isAuthorized()).toBe(true);
    expect(auth.token).toBe('gho_test');
    expect(mockKeychain.get('plover:github-access-token')).toBe('gho_test');
    expect(mockOpenExternal).toHaveBeenCalledWith('https://github.com/login/device');
  });

  it('loadSavedCredentials rehydrates from keytar', async () => {
    mockKeychain.set('plover:github-access-token', 'gho_saved');
    const auth = new GitHubAuth();
    expect(await auth.loadSavedCredentials()).toBe(true);
    expect(auth.token).toBe('gho_saved');
  });

  it('returns false from loadSavedCredentials when no token is saved', async () => {
    const auth = new GitHubAuth();
    expect(await auth.loadSavedCredentials()).toBe(false);
    expect(auth.token).toBeNull();
  });

  it('disconnect clears keytar and in-memory token', async () => {
    mockKeychain.set('plover:github-access-token', 'gho_saved');
    const auth = new GitHubAuth();
    await auth.loadSavedCredentials();
    await auth.disconnect();
    expect(mockKeychain.get('plover:github-access-token')).toBeUndefined();
    expect(auth.token).toBeNull();
    expect(await auth.isAuthorized()).toBe(false);
  });

  it('throws AuthenticationError on a terminal poll error', async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          device_code: 'dc',
          user_code: 'ABCD-1234',
          verification_uri: 'https://github.com/login/device',
          interval: 0,
          expires_in: 900,
        }),
      })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ error: 'access_denied' }) });

    const auth = new GitHubAuth();
    await expect(auth.authorizeDeviceFlow()).rejects.toThrow('access_denied');
  });
});
