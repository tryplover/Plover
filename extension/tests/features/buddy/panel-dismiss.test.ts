import { describe, expect, it } from "vitest";
import {
  PANEL_CLOSE_MESSAGE,
  isCloseKey,
  isPanelCloseMessage,
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
