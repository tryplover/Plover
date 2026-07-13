import { getPloverToken, clearPloverToken } from '../auth/plover-token.js';

function resolveBackendUrl(): string {
  try {
    const fromVite = (import.meta as unknown as { env?: Record<string, string | undefined> }).env
      ?.PLOVER_BACKEND_URL;
    if (fromVite) return fromVite.replace(/\/$/, '');
  } catch {
    // ignore — import.meta.env not defined in this runtime
  }
  return (process.env.PLOVER_BACKEND_URL ?? 'http://localhost:3000').replace(/\/$/, '');
}

export class UnauthorizedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

export async function authedFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const token = await getPloverToken();
  if (!token) {
    throw new UnauthorizedError('no plover token — user must sign in');
  }
  const headers = new Headers(init.headers);
  headers.set('X-Plover-Auth-Token', token);
  const backendUrl = resolveBackendUrl();
  const url = path.startsWith('http')
    ? path
    : `${backendUrl}${path.startsWith('/') ? '' : '/'}${path}`;
  const res = await fetch(url, { ...init, headers });
  if (res.status === 401) {
    await clearPloverToken().catch((err: unknown) => {
      console.error('[authedFetch] Failed to clear token:', err);
    });
    throw new UnauthorizedError('plover token invalid or revoked');
  }
  return res;
}
