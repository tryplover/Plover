import { useEffect, useState } from "react";
import { browser } from "wxt/browser";
import { getSettings, isSettingsChange } from "@/shared/storage";
import type { Settings } from "@/shared/types";

export function useSyncedSettings(): Settings | null {
  const [settings, setSettings] = useState<Settings | null>(null);
  useEffect(() => {
    let alive = true;
    const load = () => void getSettings().then((s) => alive && setSettings(s));
    load();
    const onChanged: Parameters<
      typeof browser.storage.onChanged.addListener
    >[0] = (changes, area) => {
      if (isSettingsChange(changes, area)) load();
    };
    browser.storage.onChanged.addListener(onChanged);
    return () => {
      alive = false;
      browser.storage.onChanged.removeListener(onChanged);
    };
  }, []);
  return settings;
}
