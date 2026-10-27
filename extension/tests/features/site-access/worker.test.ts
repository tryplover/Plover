import { fakeBrowser } from "wxt/testing/fake-browser";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  registerSiteAccess,
  syncBuddyScript,
} from "@/features/site-access/worker";
import { enqueue } from "@/worker/queue";

type PermsListener = (p: { origins?: string[] }) => void;

const scripting = {
  getRegisteredContentScripts: vi.fn(),
  registerContentScripts: vi.fn(),
  updateContentScripts: vi.fn(),
  unregisterContentScripts: vi.fn(),
  executeScript: vi.fn(),
};
const permissions = {
  getAll: vi.fn(),
  onAdded: { addListener: vi.fn() },
  onRemoved: { addListener: vi.fn() },
};
const tabsQuery = vi.fn();

beforeEach(() => {
  fakeBrowser.reset();
  for (const fn of [
    ...Object.values(scripting),
    permissions.getAll,
    permissions.onAdded.addListener,
    permissions.onRemoved.addListener,
    tabsQuery,
  ])
    fn.mockReset();
  scripting.getRegisteredContentScripts.mockResolvedValue([]);
  scripting.executeScript.mockResolvedValue([]);
  permissions.getAll.mockResolvedValue({ origins: [] });
  tabsQuery.mockResolvedValue([]);
  const fb = fakeBrowser as unknown as Record<string, unknown>;
  fb.scripting = scripting;
  fb.permissions = permissions;
  (fakeBrowser.tabs as unknown as Record<string, unknown>).query = tabsQuery;
});

describe("syncBuddyScript", () => {
  it("does nothing when nothing is granted or registered", async () => {
    await syncBuddyScript();
    expect(scripting.registerContentScripts).not.toHaveBeenCalled();
    expect(scripting.unregisterContentScripts).not.toHaveBeenCalled();
  });

  it("unregisters when nothing is granted but a script is registered", async () => {
    scripting.getRegisteredContentScripts.mockResolvedValue([
      { id: "plover-buddy" },
    ]);
    await syncBuddyScript();
    expect(scripting.unregisterContentScripts).toHaveBeenCalledWith({
      ids: ["plover-buddy"],
    });
  });

  it("registers the buddy script for all sites", async () => {
    permissions.getAll.mockResolvedValue({ origins: ["<all_urls>"] });
    await syncBuddyScript();
    expect(scripting.registerContentScripts).toHaveBeenCalledWith([
      expect.objectContaining({
        id: "plover-buddy",
        js: ["content-scripts/content.js"],
        matches: ["<all_urls>"],
      }),
    ]);
  });

  it("updates an already registered script with the new matches", async () => {
    permissions.getAll.mockResolvedValue({ origins: ["*://x.com/*"] });
    scripting.getRegisteredContentScripts.mockResolvedValue([
      { id: "plover-buddy" },
    ]);
    await syncBuddyScript();
    expect(scripting.updateContentScripts).toHaveBeenCalledWith([
      expect.objectContaining({ matches: ["*://x.com/*"] }),
    ]);
    expect(scripting.registerContentScripts).not.toHaveBeenCalled();
  });
});

describe("registerSiteAccess", () => {
  function listeners(): { added: PermsListener; removed: PermsListener } {
    registerSiteAccess();
    return {
      added: permissions.onAdded.addListener.mock
        .calls[0]?.[0] as PermsListener,
      removed: permissions.onRemoved.addListener.mock
        .calls[0]?.[0] as PermsListener,
    };
  }

  it("re-syncs and injects into open tabs when origins are added", async () => {
    permissions.getAll.mockResolvedValue({ origins: ["*://x.com/*"] });
    tabsQuery.mockResolvedValue([{ id: 1 }, {}, { id: 3 }]);
    scripting.executeScript
      .mockRejectedValueOnce(new Error("restricted"))
      .mockResolvedValue([]);
    listeners().added({ origins: ["*://x.com/*"] });

    await vi.waitFor(() =>
      expect(scripting.executeScript).toHaveBeenCalledTimes(2),
    );
    expect(scripting.registerContentScripts).toHaveBeenCalled();
    expect(tabsQuery).toHaveBeenCalledWith({ url: ["*://x.com/*"] });
    expect(scripting.executeScript).toHaveBeenCalledWith({
      target: { tabId: 3 },
      files: ["content-scripts/content.js"],
    });
  });

  it("ignores added events without origins", async () => {
    listeners().added({});
    await enqueue(async () => undefined);
    expect(permissions.getAll).not.toHaveBeenCalled();
  });

  it("re-syncs when origins are removed", async () => {
    scripting.getRegisteredContentScripts.mockResolvedValue([
      { id: "plover-buddy" },
    ]);
    listeners().removed({ origins: ["*://x.com/*"] });
    await vi.waitFor(() =>
      expect(scripting.unregisterContentScripts).toHaveBeenCalledWith({
        ids: ["plover-buddy"],
      }),
    );
  });
});
