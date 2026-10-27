import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS } from "@/lib/storage";
import { isBuddyVisible, nearestCorner } from "@/lib/visibility";

describe("isBuddyVisible", () => {
  it("is false for non-web urls and missing urls", () => {
    expect(isBuddyVisible("chrome://newtab", DEFAULT_SETTINGS)).toBe(false);
    expect(isBuddyVisible(undefined, DEFAULT_SETTINGS)).toBe(false);
    expect(isBuddyVisible("file:///x", DEFAULT_SETTINGS)).toBe(false);
    expect(isBuddyVisible("not a url", DEFAULT_SETTINGS)).toBe(false);
  });

  it("is true for ordinary web pages", () => {
    expect(isBuddyVisible("https://example.com/a", DEFAULT_SETTINGS)).toBe(
      true,
    );
  });

  it("hides on hidden sites including subdomains", () => {
    const s = { ...DEFAULT_SETTINGS, hiddenSites: ["figma.com"] };
    expect(isBuddyVisible("https://www.figma.com/file/1", s)).toBe(false);
    expect(isBuddyVisible("https://figma.com", s)).toBe(false);
    expect(isBuddyVisible("https://notfigma.com", s)).toBe(true);
  });

  it("hides everywhere when set", () => {
    const s = { ...DEFAULT_SETTINGS, hideEverywhere: true };
    expect(isBuddyVisible("https://example.com", s)).toBe(false);
  });
});

describe("nearestCorner", () => {
  it("picks the closest corner", () => {
    expect(nearestCorner(10, 10, 1000, 800)).toBe("top-left");
    expect(nearestCorner(990, 790, 1000, 800)).toBe("bottom-right");
    expect(nearestCorner(990, 10, 1000, 800)).toBe("top-right");
    expect(nearestCorner(10, 790, 1000, 800)).toBe("bottom-left");
  });
});
