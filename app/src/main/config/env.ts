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

export function resolveViteOrEnv(
  name: string,
  { devFallback }: { devFallback: string },
): string {
  try {
    const fromVite = (import.meta as unknown as {
      env?: Record<string, string | undefined>;
    }).env?.[name];
    if (fromVite) return fromVite;
  } catch {
    // import.meta.env undefined outside Vite-built bundle
  }
  return resolveRequiredEnv(name, { devFallback });
}
