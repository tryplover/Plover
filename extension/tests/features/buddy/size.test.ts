import { describe, expect, it } from "vitest";
import { BUDDY_DIMENSIONS, panelOffset } from "@/features/buddy/size";

describe("BUDDY_DIMENSIONS", () => {
  it("keeps medium at today's size", () => {
    expect(BUDDY_DIMENSIONS.medium).toEqual({ width: 64, height: 70 });
  });

  it("grows small < medium < large on both axes", () => {
    expect(BUDDY_DIMENSIONS.small.width).toBeLessThan(
      BUDDY_DIMENSIONS.medium.width,
    );
    expect(BUDDY_DIMENSIONS.medium.width).toBeLessThan(
      BUDDY_DIMENSIONS.large.width,
    );
    expect(BUDDY_DIMENSIONS.small.height).toBeLessThan(
      BUDDY_DIMENSIONS.medium.height,
    );
    expect(BUDDY_DIMENSIONS.medium.height).toBeLessThan(
      BUDDY_DIMENSIONS.large.height,
    );
  });
});

describe("panelOffset", () => {
  it("matches the medium offset used before sizes existed", () => {
    expect(panelOffset("medium", 16, 8, 28)).toBe(130);
  });

  it("grows by exactly the height difference for large", () => {
    expect(
      panelOffset("large", 16, 8, 28) - panelOffset("medium", 16, 8, 28),
    ).toBe(BUDDY_DIMENSIONS.large.height - BUDDY_DIMENSIONS.medium.height);
  });
});
