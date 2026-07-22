import { resolveViteOrEnv } from '../config/env.js';

export function getBackendUrl(): string {
  return resolveViteOrEnv('PLOVER_BACKEND_URL', {
    devFallback: 'http://localhost:3000',
  }).replace(/\/$/, '');
}
