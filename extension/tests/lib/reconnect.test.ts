import { describe, expect, it } from "vitest";
import { INITIAL_DELAY_MS, MAX_DELAY_MS, nextReconnect } from "@/lib/reconnect";

describe("nextReconnect", () => {
  it("backs off exponentially and caps", () => {
    let d = INITIAL_DELAY_MS;
    const seen = [d];
    for (let i = 0; i < 10; i++) {
      const r = nextReconnect(d, true);
      if (!r) throw new Error("should retry");
      d = r.delayMs;
      seen.push(d);
    }
    expect(seen.slice(0, 4)).toEqual([500, 1000, 2000, 4000]);
    expect(Math.max(...seen)).toBe(MAX_DELAY_MS);
    expect(MAX_DELAY_MS).toBe(30_000);
  });

  it("stops when the extension context is invalidated", () => {
    expect(nextReconnect(500, false)).toBeNull();
  });
});
