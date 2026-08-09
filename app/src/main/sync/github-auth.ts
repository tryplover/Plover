import keytar from 'keytar';
import { shell } from 'electron';
import { resolveRequiredEnv } from '../config/env.js';

const CLIENT_ID = resolveRequiredEnv('GITHUB_CLIENT_ID', { devFallback: 'mock-client-id' });
const KEYCHAIN_SERVICE = 'plover';
const KEYCHAIN_ACCOUNT = 'github-access-token';
const DEVICE_CODE_SCOPE = 'repo read:user';

interface DeviceCodeResponse {
  device_code: string;
  user_code: string;
  verification_uri: string;
  interval: number;
  expires_in: number;
}

interface AccessTokenResponse {
  access_token?: string;
  error?: string;
}

export class AuthenticationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthenticationError';
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class GitHubAuth {
  private accessToken: string | null = null;

  get token(): string | null {
    return this.accessToken;
  }

  async loadSavedCredentials(): Promise<boolean> {
    try {
      const token = await keytar.getPassword(KEYCHAIN_SERVICE, KEYCHAIN_ACCOUNT);
      if (token) {
        this.accessToken = token;
        return true;
      }
    } catch (error) {
      console.error('Failed to load GitHub credentials from keychain:', error);
    }
    return false;
  }

  async isAuthorized(): Promise<boolean> {
    return !!this.accessToken;
  }

  async disconnect(): Promise<void> {
    try {
      await keytar.deletePassword(KEYCHAIN_SERVICE, KEYCHAIN_ACCOUNT);
    } catch (error) {
      console.error('Failed to delete GitHub credentials from keychain:', error);
    }
    this.accessToken = null;
  }

  async authorizeDeviceFlow(): Promise<void> {
    const deviceCodeResponse = await fetch('https://github.com/login/device/code', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ client_id: CLIENT_ID, scope: DEVICE_CODE_SCOPE }),
    });

    if (!deviceCodeResponse.ok) {
      throw new AuthenticationError('Failed to start GitHub device flow');
    }

    const { device_code, user_code, verification_uri, interval, expires_in } =
      (await deviceCodeResponse.json()) as DeviceCodeResponse;

    console.log(`Enter this code on GitHub to authorize Plover: ${user_code}`);
    await shell.openExternal(verification_uri);

    const deadline = Date.now() + expires_in * 1000;
    let pollIntervalMs = interval * 1000;

    for (;;) {
      if (Date.now() >= deadline) {
        throw new AuthenticationError('GitHub device flow authorization timed out');
      }

      await delay(pollIntervalMs);

      const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          client_id: CLIENT_ID,
          device_code,
          grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
        }),
      });

      if (!tokenResponse.ok) {
        throw new AuthenticationError('Failed to poll GitHub for access token');
      }

      const result = (await tokenResponse.json()) as AccessTokenResponse;

      if (result.access_token) {
        this.accessToken = result.access_token;
        await keytar.setPassword(KEYCHAIN_SERVICE, KEYCHAIN_ACCOUNT, result.access_token);
        return;
      }

      if (result.error === 'authorization_pending') {
        continue;
      }

      if (result.error === 'slow_down') {
        pollIntervalMs += 5000;
        continue;
      }

      throw new AuthenticationError(`GitHub device flow error: ${result.error}`);
    }
  }
}
