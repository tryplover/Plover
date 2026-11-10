import { describe, expect, it } from "vitest";
import { clampInput } from "@/shared/number-input";

describe("clampInput", () => {
  it("keeps a value in range", () => {
    expect(clampInput("25", 1, 90)).toBe(25);
  });
  it("falls back to the minimum when empty, zero or not a number", () => {
    expect(clampInput("", 1, 90)).toBe(1);
    expect(clampInput("  ", 1, 90)).toBe(1);
    expect(clampInput("0", 1, 90)).toBe(1);
    expect(clampInput("-4", 1, 90)).toBe(1);
    expect(clampInput("abc", 1, 90)).toBe(1);
  });
  it("caps at the maximum and drops decimals", () => {
    expect(clampInput("500", 1, 90)).toBe(90);
    expect(clampInput("7.9", 1, 90)).toBe(7);
  });
});
