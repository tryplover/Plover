import http from 'http';
import { shell } from 'electron';
import { getSupabaseClient } from './supabase-client.js';

const SIGN_IN_TIMEOUT_MS = 5 * 60 * 1000;

// Fixed rather than an OS-assigned ephemeral port: Supabase's Redirect URLs
// allowlist matches exact URLs (or globs), so a different port on every
// sign-in attempt can never be pre-registered there. Supabase silently falls
// back to the project's default Site URL when redirectTo doesn't match the
// allowlist, which looks like "sign-in completed on the website, desktop app
// never hears back." This port must also be added as an exact entry under
// Authentication -> URL Configuration -> Redirect URLs in the Supabase
// dashboard: http://localhost:44321
const OAUTH_CALLBACK_PORT = 44321;

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

    // Registered before `listen()` so it also catches synchronous/early
    // startup failures (e.g. the port becoming unavailable between bind
    // attempts), not just errors raised after the server is up.
    server.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE') {
        finish(() =>
          reject(
            new SupabaseAuthenticationError(
              `Port ${OAUTH_CALLBACK_PORT} is already in use by another application. Close it and try signing in again.`,
            ),
          ),
        );
        return;
      }
      finish(() => reject(err));
    });

    server.listen(OAUTH_CALLBACK_PORT, '127.0.0.1', () => {
      void (async () => {
        try {
          const redirectUri = `http://localhost:${OAUTH_CALLBACK_PORT}`;

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
                    reject(
                      new SupabaseAuthenticationError('Missing authorization code in redirect'),
                    ),
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

          // getSupabaseClient() throws if SUPABASE_URL/SUPABASE_ANON_KEY are
          // missing; this try/catch (rather than leaving this as an
          // unawaited async listen callback) is what turns that into a
          // rejected signIn() promise instead of an unhandled rejection
          // that crashes the Electron main process.
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

          await shell.openExternal(data.url);
        } catch (err) {
          finish(() => reject(err instanceof Error ? err : new Error(String(err))));
        }
      })();
    });
  });
}

export async function signUp(
  email: string,
  password: string,
): Promise<{ needsEmailConfirmation: boolean }> {
  const { data, error } = await getSupabaseClient().auth.signUp({ email, password });
  if (error) throw new SupabaseAuthenticationError(error.message);
  return { needsEmailConfirmation: !data.session };
}

export async function signInWithPassword(email: string, password: string): Promise<void> {
  const { error } = await getSupabaseClient().auth.signInWithPassword({ email, password });
  if (error) throw new SupabaseAuthenticationError(error.message);
}

export async function signOut(): Promise<void> {
  await getSupabaseClient().auth.signOut();
}

// Called as a floating promise at app startup (before any window exists to
// surface an error to), so this must never reject — a missing
// SUPABASE_URL/SUPABASE_ANON_KEY (getSupabaseClient() throws) or an
// unexpected null `data` would otherwise become an unhandled rejection that
// can crash the Electron main process.
export async function restoreSession(): Promise<boolean> {
  try {
    const { data } = await getSupabaseClient().auth.getSession();
    return !!data?.session;
  } catch (err) {
    console.error('[Auth] Failed to restore Supabase session:', err);
    return false;
  }
}

export function startAutoRefresh(): void {
  try {
    void getSupabaseClient().auth.startAutoRefresh();
  } catch (err) {
    console.error('[Auth] Failed to start Supabase auto-refresh:', err);
  }
}

export async function getCurrentUser(): Promise<{ id: string; email: string | null } | null> {
  try {
    const { data } = await getSupabaseClient().auth.getUser();
    if (!data?.user) return null;
    return { id: data.user.id, email: data.user.email ?? null };
  } catch (err) {
    console.error('[Auth] Failed to get current Supabase user:', err);
    return null;
  }
}
