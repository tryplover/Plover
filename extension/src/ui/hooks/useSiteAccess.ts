import { useEffect, useState } from "react";
import { browser } from "wxt/browser";
import { ALL_SITES } from "@/features/site-access/origins";

export function useAllSitesAccess(): boolean | null {
  const [granted, setGranted] = useState<boolean | null>(null);

  useEffect(() => {
    let alive = true;
    const refresh = () => {
      void browser.permissions.contains({ origins: [ALL_SITES] }).then((ok) => {
        if (alive) setGranted(ok);
      });
    };
    refresh();
    browser.permissions.onAdded.addListener(refresh);
    browser.permissions.onRemoved.addListener(refresh);
    return () => {
      alive = false;
      browser.permissions.onAdded.removeListener(refresh);
      browser.permissions.onRemoved.removeListener(refresh);
    };
  }, []);

  return granted;
}

export function useSiteAccess(): boolean {
  return useAllSitesAccess() === true;
}
