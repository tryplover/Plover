import { browser } from "wxt/browser";
import {
  STATE_PORT,
  deriveBuddyState,
  type BuddySnapshot,
} from "@/features/buddy/buddy-state";
import { getLocal } from "@/shared/storage";

export { STATE_PORT };

async function snapshotAt(
  now: number,
): Promise<{ snap: BuddySnapshot; expiresIn: number | null }> {
  const [timer, focus, transient] = await Promise.all([
    getLocal("timer"),
    getLocal("focus"),
    getLocal("transient"),
  ]);
  const windows = [transient.nudgeUntil, transient.celebrateUntil].filter(
    (t) => t > now,
  );
  return {
    snap: {
      buddyState: deriveBuddyState({ timer, focus, transient }, now),
      nudgeText: transient.nudgeUntil > now ? transient.nudgeText : null,
      checkInPending: transient.checkInPending,
    },
    expiresIn: windows.length ? Math.min(...windows) - now : null,
  };
}

export async function buildSnapshot(): Promise<BuddySnapshot> {
  return (await snapshotAt(Date.now())).snap;
}

export function registerStatePort(): void {
  browser.runtime.onConnect.addListener((port) => {
    if (port.name !== STATE_PORT) return;
    let open = true;
    let expiry: ReturnType<typeof setTimeout> | undefined;
    const push = () => {
      void snapshotAt(Date.now()).then(({ snap, expiresIn }) => {
        if (!open) return;
        port.postMessage(snap);
        clearTimeout(expiry);
        if (expiresIn !== null) expiry = setTimeout(push, expiresIn);
      });
    };
    const onChanged = (_changes: unknown, area: string) => {
      if (area === "local") push();
    };
    port.onDisconnect.addListener(() => {
      open = false;
      clearTimeout(expiry);
      browser.storage.onChanged.removeListener(onChanged);
    });
    browser.storage.onChanged.addListener(onChanged);
    push();
  });
}
