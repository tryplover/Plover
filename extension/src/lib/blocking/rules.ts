export const BLOCKED_PAGE = "/blocked.html";

export function buildRules(
  blocklist: string[],
): chrome.declarativeNetRequest.Rule[] {
  return blocklist.map((domain, i) => ({
    id: i + 1,
    priority: 1,
    action: {
      type: "redirect" as chrome.declarativeNetRequest.RuleActionType,
      redirect: { extensionPath: BLOCKED_PAGE },
    },
    condition: {
      requestDomains: [domain],
      resourceTypes: [
        "main_frame" as chrome.declarativeNetRequest.ResourceType,
      ],
    },
  }));
}
