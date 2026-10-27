import { describe, expect, it } from "vitest";
import { manifest } from "../manifest.config";

describe("manifest", () => {
  it("requests exactly the agreed permissions", () => {
    expect(manifest.permissions).toEqual([
      "storage",
      "alarms",
      "declarativeNetRequest",
      "identity",
      "notifications",
      "tabs",
    ]);
  });

  it("has host access to all urls", () => {
    expect(manifest.host_permissions).toEqual(["<all_urls>"]);
  });

  it("binds the action shortcut to Alt+Shift+P", () => {
    expect(manifest.commands?._execute_action?.suggested_key?.default).toBe(
      "Alt+Shift+P",
    );
  });

  it("exposes blocked.html and panel.html only via dynamic urls", () => {
    expect(manifest.web_accessible_resources).toEqual([
      {
        resources: ["blocked.html", "panel.html"],
        matches: ["<all_urls>"],
        use_dynamic_url: true,
      },
    ]);
  });
});
