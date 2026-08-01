import { app } from 'electron';
import { readViteEnv } from './vite-env.js';

export function resolveRequiredEnv(name: string, { devFallback }: { devFallback: string }): string {
  const fromVite = readViteEnv(name);
  if (fromVite) return fromVite;

  const value = process.env[name];
  if (value && value.length > 0) return value;
  if (app?.isPackaged) {
    console.error(
      `[env] WARNING: Required environment variable ${name} is missing in packaged build. ` +
        `Using devFallback "${devFallback}".`,
    );
  }
  return devFallback;
}
