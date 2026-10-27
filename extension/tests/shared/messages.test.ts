import { describe, expect, it } from "vitest";
import { isCommand } from "@/shared/messages";

describe("isCommand", () => {
  it("accepts known command types", () => {
    expect(isCommand({ type: "timer/start" })).toBe(true);
    expect(isCommand({ type: "step/toggle", taskId: "a", stepId: "b" })).toBe(
      true,
    );
  });

  it("rejects everything else", () => {
    for (const v of [
      null,
      undefined,
      "timer/start",
      42,
      {},
      { type: 1 },
      { type: "nope" },
      { type: "constructor" },
    ]) {
      expect(isCommand(v)).toBe(false);
    }
  });
});
