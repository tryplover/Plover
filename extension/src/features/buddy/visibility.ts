import { hostMatchesDomain, httpHostname } from "@/shared/host";
import type { Settings } from "@/shared/types";

export function isBuddyVisible(
  url: string | undefined,
  settings: Settings,
): boolean {
  if (!url || settings.hideEverywhere) return false;
  const host = httpHostname(url);
  if (!host) return false;
  return !settings.hiddenSites.some((d) => hostMatchesDomain(host, d));
}

export function nearestCorner(
  x: number,
  y: number,
  w: number,
  h: number,
): Settings["buddyCorner"] {
  const vertical = y < h / 2 ? "top" : "bottom";
  const horizontal = x < w / 2 ? "left" : "right";
  return `${vertical}-${horizontal}`;
}
