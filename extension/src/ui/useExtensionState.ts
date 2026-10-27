import { useEffect, useRef, useState } from "react";
import { browser } from "wxt/browser";
import type { StateSnapshot } from "@/background/state-port";
import { STATE_PORT } from "@/background/state-port";
import { INITIAL_DELAY_MS, nextReconnect } from "@/lib/reconnect";
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

export type StateTransport = "storage" | "port" | "none";

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

    if (transport === "none") {
      return () => clearInterval(id);
    }

    if (transport === "port") {
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
          const snap = msg as StateSnapshot;
          setSettings(snap.settings);
          setLocalState(snap.local);
          setReady(true);
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
