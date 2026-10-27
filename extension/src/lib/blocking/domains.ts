const HOST = /^([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+([a-z]{2,}|xn--[a-z0-9-]+)$/;

export function normalizeDomain(input: string): string | null {
  const trimmed = input.trim().toLowerCase();
  if (!trimmed || /[\s@]/.test(trimmed)) return null;
  let host: string;
  try {
    host = new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`)
      .hostname;
  } catch {
    return null;
  }
  host = host.replace(/\.$/, "").replace(/^www\./, "");
  return HOST.test(host) ? host : null;
}

export function isBlockedUrl(url: string, blocklist: string[]): boolean {
  let host: string;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:")
      return false;
    host = parsed.hostname.toLowerCase();
  } catch {
    return false;
  }
  return cleanBlocklist(blocklist).some(
    (d) => host === d || host.endsWith(`.${d}`),
  );
}

export function cleanBlocklist(blocklist: string[]): string[] {
  return blocklist.flatMap((entry) => {
    const d = normalizeDomain(entry);
    return d ? [d] : [];
  });
}
