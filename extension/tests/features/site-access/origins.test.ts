import { describe, expect, it } from "vitest";
import {
  DISMISS_MS,
  bannerState,
  buddyMatches,
  hasHostAccess,
  originForUrl,
  siteOrigin,
} from "@/features/site-access/origins";

describe("buddyMatches", () => {
  it("collapses everything to all_urls when all sites are granted", () => {
    expect(buddyMatches(["*://x.com/*", "<all_urls>"])).toEqual(["<all_urls>"]);
  });

  it("dedupes and sorts http, https and wildcard origins", () => {
    expect(
      buddyMatches([
        "https://b.com/*",
        "*://a.com/*",
        "http://c.com/*",
        "*://a.com/*",
      ]),
    ).toEqual(["*://a.com/*", "http://c.com/*", "https://b.com/*"]);
  });

  it("ignores subdomain-wildcard origins from blocklist grants", () => {
    expect(
      buddyMatches(["*://*.youtube.com/*", "https://*.x.com/*", "*://a.com/*"]),
    ).toEqual(["*://a.com/*"]);
    expect(buddyMatches(["*://*/*"])).toEqual(["*://*/*"]);
  });

  it("drops non-web origins and handles empty input", () => {
    expect(buddyMatches(["chrome-extension://abc/*", "file:///*"])).toEqual([]);
    expect(buddyMatches([])).toEqual([]);
  });
});

describe("originForUrl", () => {
  it("builds a wildcard-scheme origin for the page host", () => {
    expect(originForUrl("https://www.x.com/a?b")).toBe("*://www.x.com/*");
  });

  it("returns null for non-web or invalid urls", () => {
    expect(originForUrl("chrome://newtab")).toBeNull();
    expect(originForUrl(undefined)).toBeNull();
    expect(originForUrl("junk")).toBeNull();
  });
});

describe("siteOrigin", () => {
  it("covers the domain and its subdomains on any scheme", () => {
    expect(siteOrigin("youtube.com")).toBe("*://*.youtube.com/*");
  });
});

describe("hasHostAccess", () => {
  it.each([
    ["<all_urls>", "youtube.com", true],
    ["*://*/*", "youtube.com", true],
    ["*://*.youtube.com/*", "youtube.com", true],
    ["*://*.youtube.com/*", "m.youtube.com", true],
    ["*://*.com/*", "youtube.com", true],
    ["*://youtube.com/*", "youtube.com", false],
    ["https://*.youtube.com/*", "youtube.com", false],
    ["*://*.reddit.com/*", "youtube.com", false],
  ])("%s for %s -> %s", (origin, domain, expected) => {
    expect(hasHostAccess(domain, [origin])).toBe(expected);
  });

  it("is false with no origins", () => {
    expect(hasHostAccess("youtube.com", [])).toBe(false);
  });
});

describe("bannerState", () => {
  it("shows when not granted and never dismissed", () => {
    expect(bannerState(false, 0, 1000)).toBe("show");
  });

  it("hides when granted", () => {
    expect(bannerState(true, 0, 1000)).toBe("hidden");
  });

  it("hides until the dismissal expires, then shows again", () => {
    expect(bannerState(false, 5000, 4999)).toBe("hidden");
    expect(bannerState(false, 5000, 5000)).toBe("show");
  });

  it("dismisses for a week", () => {
    expect(DISMISS_MS).toBe(7 * 24 * 60 * 60 * 1000);
  });
});
