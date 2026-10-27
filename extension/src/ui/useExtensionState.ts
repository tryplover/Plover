import { useEffect, useRef, useState } from "react";
import { browser } from "wxt/browser";
import type { StateSnapshot } from "@/background/state-port";
import { STATE_PORT } from "@/background/state-port";
import {
  DEFAULT_LOCAL,
  DEFAULT_SETTINGS,
  getSettings,
  loadLocalState,
} from "@/lib/storage";
import type { LocalState, Settings } from "@/lib/types";

export interface ExtensionState {
  settings: Settings;
  local: LocalState;
  now: number;
  ready: boolean;
}

export type StateTransport = "storage" | "port";

export function useExtensionState(
  transport: StateTransport = "storage",
): ExtensionState {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [local, setLocalState] = useState<LocalState>(DEFAULT_LOCAL);
  const [now, setNow] = useState(() => Date.now());
  const [ready, setReady] = useState(false);
  const loadSeq = useRef(0);

  useEffect(() => {
    let alive = true;
    const id = setInterval(() => setNow(Date.now()), 1000);

    if (transport === "port") {
      let port: ReturnType<typeof browser.runtime.connect> | null = null;
      let retry: ReturnType<typeof setTimeout> | undefined;
      const connect = () => {
        port = browser.runtime.connect({ name: STATE_PORT });
        port.onMessage.addListener((msg) => {
          if (!alive) return;
          const snap = msg as StateSnapshot;
          setSettings(snap.settings);
          setLocalState(snap.local);
          setReady(true);
        });
        port.onDisconnect.addListener(() => {
          port = null;
          if (alive) retry = setTimeout(connect, 500);
        });
      };
      connect();
      return () => {
        alive = false;
        clearTimeout(retry);
        port?.disconnect();
        clearInterval(id);
      };
    }

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
  }, [transport]);

  return { settings, local, now, ready };
}
