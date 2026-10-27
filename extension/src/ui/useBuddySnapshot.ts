import { useEffect, useState } from "react";
import { browser } from "wxt/browser";
import { STATE_PORT, type BuddySnapshot } from "@/lib/buddy-state";
import { INITIAL_DELAY_MS, nextReconnect } from "@/lib/reconnect";

export function useBuddySnapshot(): BuddySnapshot | null {
  const [snap, setSnap] = useState<BuddySnapshot | null>(null);

  useEffect(() => {
    let alive = true;
    let port: ReturnType<typeof browser.runtime.connect> | null = null;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let delay = INITIAL_DELAY_MS;
    const scheduleRetry = () => {
      const next = nextReconnect(delay, browser.runtime?.id !== undefined);
      if (!alive || !next) return;
      retry = setTimeout(connect, delay);
      delay = next.delayMs;
    };
    const connect = () => {
      try {
        port = browser.runtime.connect({ name: STATE_PORT });
      } catch {
        port = null;
        scheduleRetry();
        return;
      }
      port.onMessage.addListener((msg) => {
        if (!alive) return;
        delay = INITIAL_DELAY_MS;
        setSnap(msg as BuddySnapshot);
      });
      port.onDisconnect.addListener(() => {
        port = null;
        scheduleRetry();
      });
    };
    connect();
    return () => {
      alive = false;
      clearTimeout(retry);
      port?.disconnect();
    };
  }, []);

  return snap;
}
