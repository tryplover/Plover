import { describe, expect, it } from "vitest";
import { insertStepAfter } from "@/features/tasks/draft-steps";

describe("insertStepAfter", () => {
  it("inserts right after the index", () => {
    expect(insertStepAfter(["a", "b", "c"], 0, "x")).toEqual([
      "a",
      "x",
      "b",
      "c",
    ]);
  });

  it("appends after the last step", () => {
    expect(insertStepAfter(["a", "b"], 1, "x")).toEqual(["a", "b", "x"]);
  });

  it("does not mutate the input", () => {
    const steps = ["a"];
    insertStepAfter(steps, 0, "x");
    expect(steps).toEqual(["a"]);
  });
});
