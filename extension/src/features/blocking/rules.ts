import { cleanBlocklist } from "@/features/blocking/domains";
import { hasHostAccess } from "@/features/site-access/origins";

export const BLOCKED_PAGE = "/blocked.html";

export function buildRules(
  blocklist: string[],
  origins: string[],
): chrome.declarativeNetRequest.Rule[] {
  return cleanBlocklist(blocklist).map((domain, i) => ({
    id: i + 1,
    priority: 1,
    action: hasHostAccess(domain, origins)
      ? {
          type: "redirect" as chrome.declarativeNetRequest.RuleActionType,
          redirect: { extensionPath: BLOCKED_PAGE },
        }
      : { type: "block" as chrome.declarativeNetRequest.RuleActionType },
    condition: {
      requestDomains: [domain],
      resourceTypes: [
        "main_frame" as chrome.declarativeNetRequest.ResourceType,
      ],
    },
  }));
}
