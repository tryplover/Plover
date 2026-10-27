export const INITIAL_DELAY_MS = 500;
export const MAX_DELAY_MS = 30_000;

export function nextReconnect(
  currentDelayMs: number,
  contextValid: boolean,
): { delayMs: number } | null {
  if (!contextValid) return null;
  return { delayMs: Math.min(currentDelayMs * 2, MAX_DELAY_MS) };
}
