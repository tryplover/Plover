export function readViteEnv(key: string): string | undefined {
  try {
    const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env;
    const value = env?.[key];
    return value && value.length > 0 ? value : undefined;
  } catch {
    return undefined;
  }
}
