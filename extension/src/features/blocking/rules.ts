import { cleanBlocklist } from "@/features/blocking/domains";
import { hasHostAccess } from "@/features/site-access/origins";

export const BLOCKED_PAGE = "/blocked.html";

const ANY_HTTP_URL = "^https?://.*$";

export function blockedPageFor(blockedPageUrl: string, url: string): string {
  return `${blockedPageUrl}#${url}`;
}

export function blockedDestination(hash: string): string | null {
  const raw = hash.startsWith("#") ? hash.slice(1) : hash;
  try {
    const url = new URL(raw);
    return url.protocol === "http:" || url.protocol === "https:"
      ? url.href
      : null;
  } catch {
    return null;
  }
}

export function buildRules(
  blocklist: string[],
  origins: string[],
  blockedPageUrl: string,
): chrome.declarativeNetRequest.Rule[] {
  return cleanBlocklist(blocklist).map((domain, i) => ({
    id: i + 1,
    priority: 1,
    action: hasHostAccess(domain, origins)
      ? {
          type: "redirect" as chrome.declarativeNetRequest.RuleActionType,
          redirect: {
            regexSubstitution: blockedPageFor(blockedPageUrl, "\\0"),
          },
        }
      : { type: "block" as chrome.declarativeNetRequest.RuleActionType },
    condition: {
      regexFilter: ANY_HTTP_URL,
      requestDomains: [domain],
      resourceTypes: [
        "main_frame" as chrome.declarativeNetRequest.ResourceType,
      ],
    },
  }));
}
