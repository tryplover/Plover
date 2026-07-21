import { app } from 'electron';

export function resolveRequiredEnv(
  name: string,
  { devFallback }: { devFallback: string },
): string {
  const value = process.env[name];
  if (value && value.length > 0) return value;
  if (app?.isPackaged) {
    throw new Error(
      `[env] Required environment variable ${name} is missing in packaged build. ` +
        `Set it via the build environment before packaging.`,
    );
  }
  return devFallback;
}
