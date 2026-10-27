import { browser } from "wxt/browser";
import { getSettings, loadLocalState } from "@/lib/storage";
import type { LocalState, Settings } from "@/lib/types";

export const STATE_PORT = "plover-state";

export interface StateSnapshot {
  local: LocalState;
  settings: Settings;
}

export async function buildSnapshot(): Promise<StateSnapshot> {
  return { local: await loadLocalState(), settings: await getSettings() };
}

export function registerStatePort(): void {
  browser.runtime.onConnect.addListener((port) => {
    if (port.name !== STATE_PORT) return;
    let open = true;
    const push = () => {
      void buildSnapshot().then((snap) => {
        if (open) port.postMessage(snap);
      });
    };
    port.onDisconnect.addListener(() => {
      open = false;
      browser.storage.onChanged.removeListener(push);
    });
    browser.storage.onChanged.addListener(push);
    push();
  });
}
