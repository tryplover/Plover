import { describe, expect, it } from "vitest";
import {
  PANEL_CLOSE_MESSAGE,
  PANEL_HEIGHT_MESSAGE,
  isCloseKey,
  isPanelCloseMessage,
  isPanelHeightMessage,
  shouldCloseOnPointer,
} from "@/features/buddy/panel-dismiss";

describe("isCloseKey", () => {
  it("accepts only Escape", () => {
    expect(isCloseKey("Escape")).toBe(true);
    expect(isCloseKey("Enter")).toBe(false);
    expect(isCloseKey("esc")).toBe(false);
  });
});

describe("shouldCloseOnPointer", () => {
  const host = new EventTarget();
  const iframe = new EventTarget();
  const other = new EventTarget();

  it("closes for a path outside the host and iframe", () => {
    expect(shouldCloseOnPointer([other, new EventTarget()], host, iframe)).toBe(
      true,
    );
    expect(shouldCloseOnPointer([], host, null)).toBe(true);
  });

  it("stays open for the buddy host or the panel iframe", () => {
    expect(shouldCloseOnPointer([other, host], host, iframe)).toBe(false);
    expect(shouldCloseOnPointer([iframe, other], host, iframe)).toBe(false);
  });
});

describe("isPanelCloseMessage", () => {
  const win = {};

  it("accepts the close message from the panel frame", () => {
    expect(isPanelCloseMessage({ type: PANEL_CLOSE_MESSAGE }, win, win)).toBe(
      true,
    );
  });

  it("rejects other sources, types and shapes", () => {
    expect(isPanelCloseMessage({ type: PANEL_CLOSE_MESSAGE }, {}, win)).toBe(
      false,
    );
    expect(isPanelCloseMessage({ type: PANEL_CLOSE_MESSAGE }, null, null)).toBe(
      false,
    );
    expect(isPanelCloseMessage({ type: "other" }, win, win)).toBe(false);
    expect(isPanelCloseMessage(null, win, win)).toBe(false);
    expect(isPanelCloseMessage("plover/panel-close", win, win)).toBe(false);
  });
});

describe("isPanelHeightMessage", () => {
  const win = {};
  const msg = (height: unknown) => ({ type: PANEL_HEIGHT_MESSAGE, height });

  it("accepts a positive finite height from the panel frame", () => {
    expect(isPanelHeightMessage(msg(320), win, win)).toBe(true);
  });

  it("rejects other sources, types and bad heights", () => {
    expect(isPanelHeightMessage(msg(320), {}, win)).toBe(false);
    expect(isPanelHeightMessage(msg(320), null, null)).toBe(false);
    expect(isPanelHeightMessage({ type: "other", height: 320 }, win, win)).toBe(
      false,
    );
    expect(isPanelHeightMessage(null, win, win)).toBe(false);
    for (const bad of [0, -5, NaN, Infinity, "320", undefined])
      expect(isPanelHeightMessage(msg(bad), win, win)).toBe(false);
  });
});
