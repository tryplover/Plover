import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import nock from 'nock';
import http from 'http';
import { GoogleAuth, AuthenticationError } from '../../src/main/sync/google-auth';

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
}));

describe('GoogleAuth', () => {
  beforeEach(() => {
    mockKeychain.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    nock.cleanAll();
  });

  it('should load saved credentials from keychain if they exist', async () => {
    mockKeychain.set('plover:google-refresh-token', 'saved-refresh-token');
    const auth = new GoogleAuth();
    const loaded = await auth.loadSavedCredentials();
    expect(loaded).toBe(true);
    expect(auth.client.credentials.refresh_token).toBe('saved-refresh-token');
  });

  it('should return false if credentials do not exist in keychain', async () => {
    const auth = new GoogleAuth();
    const loaded = await auth.loadSavedCredentials();
    expect(loaded).toBe(false);
    expect(auth.client.credentials.refresh_token).toBeUndefined();
  });

  it('should disconnect and remove credentials from keychain', async () => {
    mockKeychain.set('plover:google-refresh-token', 'some-token');
    const auth = new GoogleAuth();
    await auth.loadSavedCredentials();

    await auth.disconnect();
    expect(mockKeychain.get('plover:google-refresh-token')).toBeUndefined();
    expect(auth.client.credentials.refresh_token).toBeUndefined();
  });

  it('should start the loopback server and exchange code for token', async () => {
    nock('https://oauth2.googleapis.com').post('/token').reply(200, {
      access_token: 'new-access-token',
      refresh_token: 'new-refresh-token',
      expires_in: 3600,
    });

    const auth = new GoogleAuth();

    mockOpenExternal.mockImplementationOnce(async (urlStr: string) => {
      const parsedUrl = new URL(urlStr);
      const redirectUri = parsedUrl.searchParams.get('redirect_uri');
      const state = parsedUrl.searchParams.get('state');
      expect(redirectUri).toBeDefined();
      expect(state).toBeTruthy();

      const callbackUrl = `${redirectUri}?code=test-auth-code&state=${state}`;
      await new Promise<void>((resolve, reject) => {
        http
          .get(callbackUrl, (res) => {
            expect(res.statusCode).toBe(200);
            resolve();
          })
          .on('error', reject);
      });
      return true;
    });

    await auth.authorize();

    expect(auth.client.credentials.refresh_token).toBe('new-refresh-token');
    expect(mockKeychain.get('plover:google-refresh-token')).toBe('new-refresh-token');
  });

  it('should reject when callback state does not match expected state', async () => {
    const auth = new GoogleAuth();

    mockOpenExternal.mockImplementationOnce(async (urlStr: string) => {
      const parsedUrl = new URL(urlStr);
      const redirectUri = parsedUrl.searchParams.get('redirect_uri');

      const callbackUrl = `${redirectUri}?code=test-auth-code&state=attacker-state`;
      await new Promise<void>((resolve) => {
        http.get(callbackUrl, (res) => {
          expect(res.statusCode).toBe(400);
          resolve();
        });
      });
      return true;
    });

    await expect(auth.authorize()).rejects.toThrow(/state mismatch/i);
  });

  it('should handle oauth errors in loopback callback', async () => {
    const auth = new GoogleAuth();

    mockOpenExternal.mockImplementationOnce(async (urlStr: string) => {
      const parsedUrl = new URL(urlStr);
      const redirectUri = parsedUrl.searchParams.get('redirect_uri');

      const callbackUrl = `${redirectUri}?error=access_denied`;
      await new Promise<void>((resolve) => {
        http.get(callbackUrl, (res) => {
          expect(res.statusCode).toBe(400);
          resolve();
        });
      });
      return true;
    });

    await expect(auth.authorize()).rejects.toThrow(AuthenticationError);
  });

  it('should ignore favicon.ico and keep the server running for a valid code', async () => {
    nock('https://oauth2.googleapis.com').post('/token').reply(200, {
      access_token: 'new-access-token',
      refresh_token: 'new-refresh-token',
    });

    const auth = new GoogleAuth();

    mockOpenExternal.mockImplementationOnce(async (urlStr: string) => {
      const parsedUrl = new URL(urlStr);
      const redirectUri = parsedUrl.searchParams.get('redirect_uri');
      const state = parsedUrl.searchParams.get('state');

      const faviconUrl = `${redirectUri}/favicon.ico`;
      await new Promise<void>((resolve) => {
        http.get(faviconUrl, (res) => {
          expect(res.statusCode).toBe(404);
          resolve();
        });
      });

      const callbackUrl = `${redirectUri}?code=test-auth-code&state=${state}`;
      await new Promise<void>((resolve) => {
        http.get(callbackUrl, (res) => {
          expect(res.statusCode).toBe(200);
          resolve();
        });
      });
      return true;
    });

    await auth.authorize();
    expect(auth.client.credentials.refresh_token).toBe('new-refresh-token');
  });
});
