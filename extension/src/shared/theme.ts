import type { Theme } from "@/shared/types";

export function parseTheme(value: unknown): Theme {
  return value === "light" || value === "dark" ? value : "system";
}
