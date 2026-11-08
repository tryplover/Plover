import { describe, expect, it } from "vitest";
import {
  isTrustedWebsiteSender,
  parseExternalMessage,
} from "@/features/auth/handoff";

describe("isTrustedWebsiteSender", () => {
  it("accepts the exact production origin", () => {
    expect(
      isTrustedWebsiteSender({ origin: "https://tryplover.com" }, false),
    ).toBe(true);
    expect(
      isTrustedWebsiteSender({ origin: "https://tryplover.com" }, true),
    ).toBe(true);
  });

  it.each([
    "http://tryplover.com",
    "https://tryplover.com.evil.com",
    "https://evil.tryplover.com",
    "https://evil.com",
    "https://tryplover.com:8443",
    "",
  ])("rejects %s", (origin) => {
    expect(isTrustedWebsiteSender({ origin }, false)).toBe(false);
    expect(isTrustedWebsiteSender({ origin }, true)).toBe(false);
  });

  it("accepts localhost only in dev", () => {
    const sender = { origin: "http://localhost:5173" };
    expect(isTrustedWebsiteSender(sender, false)).toBe(false);
    expect(isTrustedWebsiteSender(sender, true)).toBe(true);
  });

  it("falls back to the url origin when origin is missing", () => {
    expect(
      isTrustedWebsiteSender(
        { url: "https://tryplover.com/connect?x=1" },
        false,
      ),
    ).toBe(true);
    expect(
      isTrustedWebsiteSender({ url: "https://tryplover.com.evil.com/" }, false),
    ).toBe(false);
  });

  it("rejects a missing or unparseable origin and url", () => {
    expect(isTrustedWebsiteSender({}, true)).toBe(false);
    expect(isTrustedWebsiteSender({ url: "not a url" }, true)).toBe(false);
  });
});

describe("parseExternalMessage", () => {
  it("parses ping", () => {
    expect(parseExternalMessage({ type: "plover/ping" })).toEqual({
      type: "ping",
    });
  });

  it("parses handoff", () => {
    expect(
      parseExternalMessage({ type: "plover/handoff", tokenHash: "aB3_-x" }),
    ).toEqual({ type: "handoff", tokenHash: "aB3_-x" });
    const max = "a".repeat(512);
    expect(
      parseExternalMessage({ type: "plover/handoff", tokenHash: max }),
    ).toEqual({ type: "handoff", tokenHash: max });
  });

  it.each([
    null,
    undefined,
    "plover/ping",
    42,
    {},
    { type: "auth/handoff", tokenHash: "abc" },
    { type: "plover/other" },
    { type: "plover/handoff" },
    { type: "plover/handoff", tokenHash: "" },
    { type: "plover/handoff", tokenHash: 123 },
    { type: "plover/handoff", tokenHash: "a".repeat(513) },
    { type: "plover/handoff", tokenHash: "abc def" },
    { type: "plover/handoff", tokenHash: "abc/def" },
    { type: "plover/handoff", tokenHash: "abc\n" },
  ])("rejects %j", (msg) => {
    expect(parseExternalMessage(msg)).toBeNull();
  });
});
