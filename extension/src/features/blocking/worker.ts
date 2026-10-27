import { browser } from "wxt/browser";
import { isBlockedUrl } from "@/features/blocking/domains";
import { BLOCKED_PAGE, buildRules } from "@/features/blocking/rules";
import { getSettings, setLocal } from "@/shared/storage";

async function installRules(blocklist: string[]): Promise<void> {
  const { origins = [] } = await browser.permissions.getAll();
  const existing = await browser.declarativeNetRequest.getDynamicRules();
  await browser.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: existing.map((r) => r.id),
    addRules: buildRules(blocklist, origins),
  });
}

async function redirectOpenTabs(blocklist: string[]): Promise<void> {
  const blockedUrl = browser.runtime.getURL(BLOCKED_PAGE as "/blocked.html");
  const tabs = await browser.tabs.query({});
  for (const tab of tabs) {
    if (tab.id === undefined || !tab.url) continue;
    if (isBlockedUrl(tab.url, blocklist))
      await browser.tabs.update(tab.id, { url: blockedUrl });
  }
}

export async function setBlocking(on: boolean): Promise<void> {
  const { blocklist } = await getSettings();
  await installRules(on ? blocklist : []);
  await setLocal({ blockingOn: on });
  if (on) await redirectOpenTabs(blocklist);
}

export async function reapplyBlocking(): Promise<void> {
  const { blocklist } = await getSettings();
  await installRules(blocklist);
  await redirectOpenTabs(blocklist);
}
