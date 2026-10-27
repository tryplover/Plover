import { useEffect, useRef, useState } from "react";
import { browser } from "wxt/browser";
import {
  DEFAULT_LOCAL,
  DEFAULT_SETTINGS,
  getSettings,
  loadLocalState,
} from "@/shared/storage";
import type { LocalState, Settings } from "@/shared/types";

export interface ExtensionState {
  settings: Settings;
  local: LocalState;
  now: number;
  ready: boolean;
}

export function useExtensionState(): ExtensionState {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [local, setLocalState] = useState<LocalState>(DEFAULT_LOCAL);
  const [now, setNow] = useState(() => Date.now());
  const [ready, setReady] = useState(false);
  const loadSeq = useRef(0);

  useEffect(() => {
    let alive = true;
    const id = setInterval(() => setNow(Date.now()), 1000);

    const refresh = () => {
      const seq = ++loadSeq.current;
      void Promise.all([getSettings(), loadLocalState()]).then(([s, l]) => {
        if (!alive || seq !== loadSeq.current) return;
        setSettings(s);
        setLocalState(l);
        setReady(true);
      });
    };
    refresh();
    browser.storage.onChanged.addListener(refresh);
    return () => {
      alive = false;
      browser.storage.onChanged.removeListener(refresh);
      clearInterval(id);
    };
  }, []);

  return { settings, local, now, ready };
}
