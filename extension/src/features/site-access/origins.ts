import { httpHostname } from "@/shared/host";

export const ALL_SITES = "<all_urls>";

export function buddyMatches(origins: string[]): string[] {
  if (origins.includes(ALL_SITES)) return [ALL_SITES];
  return [
    ...new Set(origins.filter((o) => /^(\*|https?):\/\//.test(o))),
  ].sort();
}

export function originForUrl(url: string | undefined): string | null {
  const host = url ? httpHostname(url) : null;
  return host ? `*://${host}/*` : null;
}
