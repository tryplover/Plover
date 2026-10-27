import { describe, expect, it } from "vitest";
import { buildRules } from "@/lib/blocking/rules";

describe("buildRules", () => {
  it("builds one main-frame redirect rule per domain with ids 1..n", () => {
    expect(buildRules(["youtube.com", "reddit.com"])).toEqual([
      {
        id: 1,
        priority: 1,
        action: {
          type: "redirect",
          redirect: { extensionPath: "/blocked.html" },
        },
        condition: {
          requestDomains: ["youtube.com"],
          resourceTypes: ["main_frame"],
        },
      },
      {
        id: 2,
        priority: 1,
        action: {
          type: "redirect",
          redirect: { extensionPath: "/blocked.html" },
        },
        condition: {
          requestDomains: ["reddit.com"],
          resourceTypes: ["main_frame"],
        },
      },
    ]);
  });

  it("returns no rules for an empty blocklist", () => {
    expect(buildRules([])).toEqual([]);
  });
});
