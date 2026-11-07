import { parseTheme } from "@/shared/theme";
import type { Theme } from "@/shared/types";

const CACHE_KEY = "plover-theme";

export function applyTheme(theme: Theme): void {
  if (theme === "system") delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem(CACHE_KEY, theme);
  } catch {
    // Storage can be blocked; the cache only removes a flash on first paint.
  }
}

export function applyStoredTheme(): void {
  try {
    applyTheme(parseTheme(localStorage.getItem(CACHE_KEY)));
  } catch {
    // Storage can be blocked; the page then falls back to the OS setting.
  }
}
