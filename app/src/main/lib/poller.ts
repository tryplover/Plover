export function createPoller(opts: {
  label: string;
  intervalMs: number;
  onTick: () => void | Promise<void>;
}): { start(): void; stop(): void } {
  let handle: NodeJS.Timeout | null = null;
  let running = false;
  const tick = async () => {
    if (running) return; // skip if previous tick still going
    running = true;
    try {
      await opts.onTick();
    } catch (err) {
      console.error(`[${opts.label}]`, err);
    } finally {
      running = false;
    }
  };
  return {
    start() {
      if (!handle) {
        void tick();
        handle = setInterval(tick, opts.intervalMs);
      }
    },
    stop() {
      if (handle) {
        clearInterval(handle);
        handle = null;
      }
    },
  };
}
