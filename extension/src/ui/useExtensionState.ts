import { useEffect, useState } from "react";
import { browser } from "wxt/browser";
import { DEFAULT_LOCAL, DEFAULT_SETTINGS, getSettings } from "@/lib/storage";
import type { LocalState, Settings } from "@/lib/types";

export interface ExtensionState {
  settings: Settings;
  local: LocalState;
  now: number;
  ready: boolean;
}

async function loadLocal(): Promise<LocalState> {
  const stored = await browser.storage.local.get(Object.keys(DEFAULT_LOCAL));
  return { ...DEFAULT_LOCAL, ...(stored as Partial<LocalState>) };
}

export function useExtensionState(): ExtensionState {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [local, setLocalState] = useState<LocalState>(DEFAULT_LOCAL);
  const [now, setNow] = useState(() => Date.now());
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    const refresh = () => {
      void Promise.all([getSettings(), loadLocal()]).then(([s, l]) => {
        if (!alive) return;
        setSettings(s);
        setLocalState(l);
        setReady(true);
      });
    };
    refresh();
    browser.storage.onChanged.addListener(refresh);
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      alive = false;
      browser.storage.onChanged.removeListener(refresh);
      clearInterval(id);
    };
  }, []);

  return { settings, local, now, ready };
}
