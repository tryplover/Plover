import type { Settings } from "@/shared/types";

export function isBuddyVisible(
  url: string | undefined,
  settings: Settings,
): boolean {
  if (!url || settings.hideEverywhere) return false;
  let host: string;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:")
      return false;
    host = parsed.hostname.toLowerCase();
  } catch {
    return false;
  }
  return !settings.hiddenSites.some(
    (d) => host === d || host.endsWith(`.${d}`),
  );
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
