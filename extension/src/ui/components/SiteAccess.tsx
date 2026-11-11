import { useEffect, useState } from "react";
import { browser } from "wxt/browser";
import { bannerState, originForUrl } from "@/features/site-access/origins";
import { AllSitesBanner } from "@/ui/components/AllSitesBanner";
import { useAllSitesAccess } from "@/ui/hooks/useSiteAccess";

export function SiteAccess({
  dismissedUntil,
  now,
}: {
  dismissedUntil: number;
  now: number;
}) {
  const allSites = useAllSitesAccess();
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

  const requestSite = () => {
    if (origin)
      void browser.permissions.request({ origins: [origin] }).then(setGranted);
  };
  const canOfferSite = origin !== null && !granted;

  if (allSites === null) return null;
  if (bannerState(allSites, dismissedUntil, now) === "show")
    return <AllSitesBanner onSite={canOfferSite ? requestSite : undefined} />;
  if (!canOfferSite || allSites) return null;
  return (
    <button
      type="button"
      className="plover-btn-text plover-link"
      onClick={requestSite}
    >
      Show Plover on this site
    </button>
  );
}
