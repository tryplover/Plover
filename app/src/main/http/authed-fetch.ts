import { getAccessToken } from '../auth/supabase-auth.js';
import { resolveRequiredEnv } from '../config/env.js';
import { readViteEnv } from '../config/vite-env.js';
import { NOT_SIGNED_IN_MESSAGE } from '@shared/auth-errors.js';

function resolveBackendUrl(): string {
  const fromVite = readViteEnv('PLOVER_BACKEND_URL');
  if (fromVite) return fromVite.replace(/\/$/, '');
  return resolveRequiredEnv('PLOVER_BACKEND_URL', {
    devFallback: 'http://localhost:3000',
  }).replace(/\/$/, '');
}

export class UnauthorizedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

export async function authedFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const token = await getAccessToken();
  if (!token) {
    throw new UnauthorizedError(NOT_SIGNED_IN_MESSAGE);
  }
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${token}`);
  const backendUrl = resolveBackendUrl();
  const url = path.startsWith('http')
    ? path
    : `${backendUrl}${path.startsWith('/') ? '' : '/'}${path}`;
  const res = await fetch(url, { ...init, headers });
  if (res.status === 401) {
    throw new UnauthorizedError(`Plover session expired — ${NOT_SIGNED_IN_MESSAGE}`);
  }
  return res;
}
