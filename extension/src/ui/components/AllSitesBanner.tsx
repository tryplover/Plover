import { browser } from "wxt/browser";
import { ALL_SITES } from "@/features/site-access/origins";
import { sendCommand } from "@/shared/messages";

export function AllSitesBanner({ onSite }: { onSite?: () => void }) {
  return (
    <div className="plover-banner" role="region" aria-label="Show Plover">
      <button
        type="button"
        className="plover-banner__close plover-btn-text"
        aria-label="Dismiss for a week"
        onClick={() => void sendCommand({ type: "siteAccess/dismissBanner" })}
      >
        ×
      </button>
      <p className="plover-banner__text">
        Plover isn&apos;t on your pages yet.
      </p>
      <div className="plover-row plover-banner__actions">
        <button
          type="button"
          className="plover-btn-compact"
          onClick={() =>
            void browser.permissions.request({ origins: [ALL_SITES] })
          }
        >
          Show Plover on all sites
        </button>
        {onSite && (
          <button type="button" className="plover-btn-text" onClick={onSite}>
            Just this site
          </button>
        )}
      </div>
    </div>
  );
}
