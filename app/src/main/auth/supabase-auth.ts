import http from 'http';
import { AddressInfo } from 'net';
import { shell } from 'electron';
import { getSupabaseClient } from './supabase-client.js';

const SIGN_IN_TIMEOUT_MS = 5 * 60 * 1000;

export class SupabaseAuthenticationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SupabaseAuthenticationError';
  }
}

export async function signIn(): Promise<void> {
  return new Promise((resolve, reject) => {
    const server = http.createServer();
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
      finish(() => reject(new SupabaseAuthenticationError('Sign-in timed out')));
    }, SIGN_IN_TIMEOUT_MS);

    server.listen(0, '127.0.0.1', async () => {
      const address = server.address() as AddressInfo;
      const port = address.port;
      const redirectUri = `http://localhost:${port}`;

      server.on('request', (req, res) => {
        void (async () => {
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

            if (!code && !error) {
              res.writeHead(400, { 'Content-Type': 'text/plain' });
              res.end('Invalid request');
              return;
            }

            if (error) {
              res.writeHead(400, { 'Content-Type': 'text/html' });
              res.end(`<h1>Authentication failed</h1><p>Error: ${error}</p>`);
              finish(() => reject(new SupabaseAuthenticationError(`OAuth error: ${error}`)));
              return;
            }

            if (!code) {
              res.writeHead(400, { 'Content-Type': 'text/html' });
              res.end('<h1>Authentication failed</h1><p>Missing authorization code.</p>');
              finish(() =>
                reject(new SupabaseAuthenticationError('Missing authorization code in redirect')),
              );
              return;
            }

            const { error: exchangeError } =
              await getSupabaseClient().auth.exchangeCodeForSession(code);

            if (exchangeError) {
              res.writeHead(400, { 'Content-Type': 'text/html' });
              res.end('<h1>Authentication failed</h1><p>Could not complete sign-in.</p>');
              finish(() => reject(new SupabaseAuthenticationError(exchangeError.message)));
              return;
            }

            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end('<h1>Authentication successful!</h1><p>You can close this window now.</p>');
            finish(resolve);
          } catch (err) {
            res.writeHead(500, { 'Content-Type': 'text/html' });
            res.end('<h1>Authentication failed</h1><p>Internal error occurred.</p>');
            finish(() => reject(err instanceof Error ? err : new Error(String(err))));
          }
        })();
      });

      const { data, error } = await getSupabaseClient().auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUri,
          skipBrowserRedirect: true,
        },
      });

      if (error || !data.url) {
        finish(() =>
          reject(
            new SupabaseAuthenticationError(error?.message || 'Failed to start Supabase OAuth'),
          ),
        );
        return;
      }

      try {
        await shell.openExternal(data.url);
      } catch (err) {
        finish(() => reject(err instanceof Error ? err : new Error(String(err))));
      }
    });

    server.on('error', (err) => {
      finish(() => reject(err));
    });
  });
}

export async function signOut(): Promise<void> {
  await getSupabaseClient().auth.signOut();
}

export async function restoreSession(): Promise<boolean> {
  const { data } = await getSupabaseClient().auth.getSession();
  return !!data.session;
}

export function startAutoRefresh(): void {
  void getSupabaseClient().auth.startAutoRefresh();
}

export async function getCurrentUser(): Promise<{ id: string; email: string | null } | null> {
  const { data } = await getSupabaseClient().auth.getUser();
  if (!data.user) return null;
  return { id: data.user.id, email: data.user.email ?? null };
}
