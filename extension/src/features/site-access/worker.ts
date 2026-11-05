import { browser } from "wxt/browser";
import type { ScriptPublicPath } from "wxt/utils/inject-script";
import { buddyMatches } from "@/features/site-access/origins";
import { enqueue } from "@/worker/queue";

const BUDDY_SCRIPT_ID = "plover-buddy";
const BUDDY_SCRIPT_FILE = "content-scripts/content.js";

export async function syncBuddyScript(): Promise<void> {
  const { origins = [] } = await browser.permissions.getAll();
  const matches = buddyMatches(origins);
  const existing = await browser.scripting.getRegisteredContentScripts({
    ids: [BUDDY_SCRIPT_ID],
  });
  if (matches.length === 0) {
    if (existing.length > 0)
      await browser.scripting.unregisterContentScripts({
        ids: [BUDDY_SCRIPT_ID],
      });
    return;
  }
  const script = {
    id: BUDDY_SCRIPT_ID,
    js: [BUDDY_SCRIPT_FILE],
    matches,
    runAt: "document_idle" as const,
    persistAcrossSessions: true,
  };
  if (existing.length > 0)
    await browser.scripting.updateContentScripts([script]);
  else await browser.scripting.registerContentScripts([script]);
}

export async function injectBuddy(origins: string[]): Promise<void> {
  const matches = buddyMatches(origins);
  if (matches.length === 0) return;
  const tabs = await browser.tabs.query({ url: matches });
  for (const tab of tabs) {
    if (tab.id === undefined) continue;
    await browser.scripting
      .executeScript({
        target: { tabId: tab.id },
        files: [BUDDY_SCRIPT_FILE as ScriptPublicPath],
      })
      .catch(() => undefined);
  }
}

export function registerSiteAccess(): void {
  browser.permissions.onAdded.addListener(({ origins }) => {
    if (!origins?.length) return;
    void enqueue(syncBuddyScript).then(() => injectBuddy(origins));
  });
  browser.permissions.onRemoved.addListener(({ origins }) => {
    if (!origins?.length) return;
    void enqueue(syncBuddyScript);
  });
}

export async function openWelcome(): Promise<void> {
  await browser.tabs.create({ url: browser.runtime.getURL("/welcome.html") });
}
