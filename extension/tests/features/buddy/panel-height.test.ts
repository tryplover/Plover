import { describe, expect, it } from "vitest";
import {
  DEFAULT_PANEL_HEIGHT,
  MIN_PANEL_HEIGHT,
  panelHeight,
} from "@/features/buddy/panel-height";

describe("panelHeight", () => {
  it("follows the content when there is room", () => {
    expect(panelHeight(300, 1000, 130, 16)).toBe(300);
  });

  it("caps at the space beside the buddy", () => {
    expect(panelHeight(700, 720, 130, 16)).toBe(574);
    expect(panelHeight(DEFAULT_PANEL_HEIGHT, 500, 130, 16)).toBe(354);
  });

  it("never goes below the minimum", () => {
    expect(panelHeight(50, 1000, 130, 16)).toBe(MIN_PANEL_HEIGHT);
    expect(panelHeight(400, 300, 130, 16)).toBe(MIN_PANEL_HEIGHT);
  });
});
