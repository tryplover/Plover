import http from 'http';
import { randomBytes } from 'node:crypto';
import { AddressInfo } from 'net';
import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import keytar from 'keytar';
import { shell } from 'electron';

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID || 'mock-client-id';
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || 'mock-client-secret';
const KEYCHAIN_SERVICE = 'plover';
const KEYCHAIN_ACCOUNT = 'google-refresh-token';
const AUTHORIZE_TIMEOUT_MS = 5 * 60 * 1000;

export const GOOGLE_API_SCOPES = [
  'https://www.googleapis.com/auth/drive.metadata.readonly',
];

export class AuthenticationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthenticationError';
  }
}

export class PermissionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PermissionError';
  }
}

export class GoogleAuth {
  private oauth2Client: OAuth2Client;

  constructor() {
    this.oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, 'http://localhost');
  }

  get client(): OAuth2Client {
    return this.oauth2Client;
  }

  async loadSavedCredentials(): Promise<boolean> {
    try {
      const refreshToken = await keytar.getPassword(KEYCHAIN_SERVICE, KEYCHAIN_ACCOUNT);
      if (refreshToken) {
        this.oauth2Client.setCredentials({
          refresh_token: refreshToken,
        });
        return true;
      }
    } catch (error) {
      console.error('Failed to load credentials from keychain:', error);
    }
    return false;
  }

  async authorize(): Promise<void> {
    return new Promise((resolve, reject) => {
      const server = http.createServer();
      const expectedState = randomBytes(32).toString('hex');
      let settled = false;

      const finish = (fn: () => void) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeoutHandle);
        if (typeof server.closeAllConnections === 'function') {
          server.closeAllConnections();
        }
        server.close(() => fn());
      };

      const timeoutHandle = setTimeout(() => {
        finish(() => reject(new AuthenticationError('Authorization timed out')));
      }, AUTHORIZE_TIMEOUT_MS);

      server.listen(0, '127.0.0.1', async () => {
        const address = server.address() as AddressInfo;
        const port = address.port;
        const redirectUri = `http://localhost:${port}`;

        const client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, redirectUri);

        const authUrl = client.generateAuthUrl({
          access_type: 'offline',
          scope: GOOGLE_API_SCOPES,
          prompt: 'consent',
          state: expectedState,
        });

        server.on('request', async (req, res) => {
          try {
            const reqUrl = req.url || '';
            const parsedUrl = new URL(reqUrl, redirectUri);

            if (parsedUrl.pathname === '/favicon.ico') {
              res.writeHead(404);
              res.end();
              return;
            }

            const code = parsedUrl.searchParams.get('code');
            const error = parsedUrl.searchParams.get('error');
            const state = parsedUrl.searchParams.get('state');

            // Ignore background probes or pre-connects that aren't actual OAuth redirects
            if (!code && !error && !state) {
              res.writeHead(400, { 'Content-Type': 'text/plain' });
              res.end('Invalid request');
              return;
            }

            if (error) {
              res.writeHead(400, { 'Content-Type': 'text/html' });
              res.end(`<h1>Authentication failed</h1><p>Error: ${error}</p>`);
              finish(() => reject(new AuthenticationError(`OAuth error: ${error}`)));
              return;
            }

            if (state !== expectedState) {
              res.writeHead(400, { 'Content-Type': 'text/html' });
              res.end('<h1>Authentication failed</h1><p>State mismatch.</p>');
              finish(() => reject(new AuthenticationError('OAuth state mismatch')));
              return;
            }

            if (!code) {
              res.writeHead(400, { 'Content-Type': 'text/html' });
              res.end('<h1>Authentication failed</h1><p>Missing authorization code.</p>');
              finish(() =>
                reject(new AuthenticationError('Missing authorization code in redirect')),
              );
              return;
            }

            const { tokens } = await client.getToken(code);
            client.setCredentials(tokens);
            this.oauth2Client = client;

            if (tokens.refresh_token) {
              await keytar.setPassword(KEYCHAIN_SERVICE, KEYCHAIN_ACCOUNT, tokens.refresh_token);
            }

            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end('<h1>Authentication successful!</h1><p>You can close this window now.</p>');
            finish(resolve);
          } catch (err) {
            res.writeHead(500, { 'Content-Type': 'text/html' });
            res.end('<h1>Authentication failed</h1><p>Internal error occurred.</p>');
            finish(() => reject(err));
          }
        });

        try {
          await shell.openExternal(authUrl);
        } catch (err) {
          finish(() => reject(err));
        }
      });

      server.on('error', (err) => {
        finish(() => reject(err));
      });
    });
  }

  async disconnect(): Promise<void> {
    try {
      await keytar.deletePassword(KEYCHAIN_SERVICE, KEYCHAIN_ACCOUNT);
    } catch (error) {
      console.error('Failed to delete credentials from keychain:', error);
    }
    this.oauth2Client.setCredentials({});
  }

  async isAuthorized(): Promise<boolean> {
    const credentials = this.oauth2Client.credentials;
    return !!(credentials.refresh_token || credentials.access_token);
  }
}
