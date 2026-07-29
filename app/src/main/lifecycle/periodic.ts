const activeCancels = new Map<string, () => void>();

export function schedulePeriodic(
  name: string,
  intervalMs: number | (() => number),
  fn: () => Promise<void>,
): () => void {
  const existingCancel = activeCancels.get(name);
  if (existingCancel) {
    existingCancel();
  }

  let cancelled = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const resolveIntervalMs = (): number =>
    typeof intervalMs === 'function' ? intervalMs() : intervalMs;

  const schedule = async (): Promise<void> => {
    if (cancelled) return;

    try {
      await fn();
    } catch (err) {
      console.error(`[periodic:${name}] error:`, err);
    }

    if (cancelled) return;

    timer = setTimeout(() => {
      void schedule();
    }, resolveIntervalMs());
  };

  const cancel = (): void => {
    cancelled = true;
    if (timer) {
      clearTimeout(timer);
    }
    activeCancels.delete(name);
  };

  activeCancels.set(name, cancel);
  void schedule();

  return cancel;
}

export function clearAllTimers(): void {
  for (const cancel of activeCancels.values()) {
    cancel();
  }
  activeCancels.clear();
}
