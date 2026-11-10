import { describe, expect, it } from "vitest";
import {
  blockedDestination,
  blockedPageFor,
  buildRules,
} from "@/features/blocking/rules";

const PAGE = "chrome-extension://abc/blocked.html";

describe("buildRules", () => {
  it("builds one main-frame redirect rule per domain with ids 1..n", () => {
    expect(
      buildRules(["youtube.com", "reddit.com"], ["<all_urls>"], PAGE),
    ).toEqual([
      {
        id: 1,
        priority: 1,
        action: {
          type: "redirect",
          redirect: { regexSubstitution: `${PAGE}#\\0` },
        },
        condition: {
          regexFilter: "^https?://.*$",
          requestDomains: ["youtube.com"],
          resourceTypes: ["main_frame"],
        },
      },
      {
        id: 2,
        priority: 1,
        action: {
          type: "redirect",
          redirect: { regexSubstitution: `${PAGE}#\\0` },
        },
        condition: {
          regexFilter: "^https?://.*$",
          requestDomains: ["reddit.com"],
          resourceTypes: ["main_frame"],
        },
      },
    ]);
  });

  it("normalises entries and drops invalid ones", () => {
    const rules = buildRules(
      ["WWW.X.com", "junk entry", "reddit.com"],
      [],
      PAGE,
    );
    expect(rules.map((r) => [r.id, r.condition.requestDomains])).toEqual([
      [1, ["x.com"]],
      [2, ["reddit.com"]],
    ]);
  });

  it("returns no rules for an empty blocklist", () => {
    expect(buildRules([], [], PAGE)).toEqual([]);
  });

  it("uses a plain block when no host access is granted", () => {
    const rules = buildRules(["youtube.com", "reddit.com"], [], PAGE);
    expect(rules.map((r) => r.action)).toEqual([
      { type: "block" },
      { type: "block" },
    ]);
    expect(rules.map((r) => r.id)).toEqual([1, 2]);
  });

  it("chooses redirect or block per domain", () => {
    const rules = buildRules(
      ["youtube.com", "reddit.com"],
      ["*://*.youtube.com/*"],
      PAGE,
    );
    expect(rules.map((r) => r.action.type)).toEqual(["redirect", "block"]);
  });
});

describe("blocked page destination", () => {
  it("carries the original URL in the hash", () => {
    expect(blockedPageFor(PAGE, "https://x.com/a?b=1")).toBe(
      `${PAGE}#https://x.com/a?b=1`,
    );
  });

  it("reads back only http(s) URLs", () => {
    expect(blockedDestination("#https://news.example.com/docs/page?x=1")).toBe(
      "https://news.example.com/docs/page?x=1",
    );
    expect(blockedDestination("#http://a.com/#frag")).toBe(
      "http://a.com/#frag",
    );
    expect(blockedDestination("#javascript:alert(1)")).toBeNull();
    expect(blockedDestination("#chrome://settings")).toBeNull();
    expect(blockedDestination("")).toBeNull();
  });
});
