import { useEffect, useState } from "react";
import { browser } from "wxt/browser";
import { originForUrl } from "@/features/site-access/origins";

export function SiteAccess() {
  const [origin, setOrigin] = useState<string | null>(null);
  const [granted, setGranted] = useState(true);

  useEffect(() => {
    let live = true;
    void (async () => {
      const [tab] = await browser.tabs.query({
        active: true,
        currentWindow: true,
      });
      const o = originForUrl(tab?.url);
      if (!o) return;
      const has = await browser.permissions.contains({ origins: [o] });
      if (!live) return;
      setOrigin(o);
      setGranted(has);
    })();
    return () => {
      live = false;
    };
  }, []);

  if (!origin || granted) return null;
  return (
    <button
      type="button"
      className="plover-link"
      onClick={() =>
        void browser.permissions.request({ origins: [origin] }).then(setGranted)
      }
    >
      Show Plover on this site
    </button>
  );
}
