import { app } from 'electron';

export function resolveRequiredEnv(name: string, { devFallback }: { devFallback: string }): string {
  try {
    const fromVite = (import.meta as unknown as { env?: Record<string, string | undefined> }).env?.[
      name
    ];
    if (fromVite && fromVite.length > 0) return fromVite;
  } catch {
    // import.meta.env not defined outside Vite-built bundle (tests, etc.)
  }

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
