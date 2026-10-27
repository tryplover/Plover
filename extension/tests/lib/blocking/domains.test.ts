import { describe, expect, it } from "vitest";
import { isBlockedUrl, normalizeDomain } from "@/lib/blocking/domains";

describe("normalizeDomain", () => {
  it.each([
    ["https://www.YouTube.com/watch?v=1", "youtube.com"],
    ["youtube.com/", "youtube.com"],
    [" reddit.com ", "reddit.com"],
    ["m.x.com", "m.x.com"],
    ["youtube.com.", "youtube.com"],
    ["https://example.xn--p1ai/", "example.xn--p1ai"],
  ])("normalises %s", (input, expected) => {
    expect(normalizeDomain(input)).toBe(expected);
  });

  it.each(["", "not a site", "localhost", "mailto:a@b.com", "a@b.com"])(
    "rejects %j",
    (input) => {
      expect(normalizeDomain(input)).toBeNull();
    },
  );
});

describe("isBlockedUrl", () => {
  it("matches the domain and its subdomains", () => {
    expect(isBlockedUrl("https://music.youtube.com/x", ["youtube.com"])).toBe(
      true,
    );
    expect(isBlockedUrl("https://youtube.com/", ["youtube.com"])).toBe(true);
  });

  it("normalises stored entries", () => {
    expect(isBlockedUrl("https://x.com/", ["WWW.X.com"])).toBe(true);
    expect(isBlockedUrl("https://x.com/", ["junk entry"])).toBe(false);
  });

  it("does not match look-alike domains", () => {
    expect(isBlockedUrl("https://notyoutube.com", ["youtube.com"])).toBe(false);
  });

  it("ignores non-web and malformed URLs", () => {
    expect(isBlockedUrl("chrome://newtab", ["newtab"])).toBe(false);
    expect(isBlockedUrl("garbage", ["youtube.com"])).toBe(false);
  });
});
