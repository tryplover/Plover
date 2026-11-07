import { describe, expect, it } from "vitest";
import { parseTheme } from "@/shared/theme";

describe("parseTheme", () => {
  it("keeps the known themes", () => {
    expect(parseTheme("light")).toBe("light");
    expect(parseTheme("dark")).toBe("dark");
    expect(parseTheme("system")).toBe("system");
  });

  it("maps anything unknown to system", () => {
    expect(parseTheme(undefined)).toBe("system");
    expect(parseTheme(null)).toBe("system");
    expect(parseTheme("blue")).toBe("system");
    expect(parseTheme(3)).toBe("system");
  });
});
