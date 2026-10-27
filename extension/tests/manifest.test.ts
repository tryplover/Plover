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
      "scripting",
    ]);
  });

  it("asks for site access only as an optional permission", () => {
    expect(
      (manifest as { host_permissions?: string[] }).host_permissions,
    ).toBeUndefined();
    expect(manifest.optional_host_permissions).toEqual(["<all_urls>"]);
  });

  it("binds the action shortcut to Alt+Shift+P", () => {
    expect(manifest.commands?._execute_action?.suggested_key?.default).toBe(
      "Alt+Shift+P",
    );
  });

  it("keeps blocked.html static for DNR and panel.html and buddy css dynamic", () => {
    expect(manifest.web_accessible_resources).toEqual([
      { resources: ["blocked.html"], matches: ["<all_urls>"] },
      {
        resources: ["panel.html"],
        matches: ["<all_urls>"],
        use_dynamic_url: true,
      },
      {
        resources: ["content-scripts/content.css"],
        matches: ["<all_urls>"],
        use_dynamic_url: true,
      },
    ]);
  });
});
