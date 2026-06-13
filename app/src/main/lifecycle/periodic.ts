const activeTimers = new Map<string, ReturnType<typeof setTimeout>>();

export function schedulePeriodic(
  name: string,
  intervalMs: number,
  fn: () => Promise<void>,
): () => void {
  const schedule = (): void => {
    fn().catch((err) => {
      console.error(`[periodic:${name}] error:`, err);
    });

    const timer = setTimeout(schedule, intervalMs);
    activeTimers.set(name, timer);
  };

  schedule();

  return () => {
    const timer = activeTimers.get(name);
    if (timer) {
      clearTimeout(timer);
      activeTimers.delete(name);
    }
  };
}

export function clearAllTimers(): void {
  for (const timer of activeTimers.values()) {
    clearTimeout(timer);
  }
  activeTimers.clear();
}
