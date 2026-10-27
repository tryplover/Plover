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

export function siteOrigin(domain: string): string {
  return `*://*.${domain}/*`;
}

export function hasHostAccess(domain: string, origins: string[]): boolean {
  return origins.some((o) => {
    if (o === ALL_SITES) return true;
    const m = /^\*:\/\/([^/]+)\/\*$/.exec(o);
    const host = m?.[1];
    if (!host) return false;
    if (host === "*") return true;
    if (!host.startsWith("*.")) return false;
    const base = host.slice(2);
    return domain === base || domain.endsWith(`.${base}`);
  });
}
