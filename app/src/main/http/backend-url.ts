import { resolveRequiredEnv } from '../config/env.js';

export function getBackendUrl(): string {
  return resolveRequiredEnv('PLOVER_BACKEND_URL', {
    devFallback: 'http://localhost:3000',
  }).replace(/\/$/, '');
}
