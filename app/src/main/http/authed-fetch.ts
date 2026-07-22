import { getPloverToken, clearPloverToken } from '../auth/plover-token.js';
import { getBackendUrl } from './backend-url.js';

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
  const backendUrl = getBackendUrl();
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
