# Dark Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an Appearance setting (System / Light / Dark) that every Plover surface honours.

**Architecture:** A `theme` field in synced `Settings`. Colour tokens use CSS `light-dark()` and are pinned by `data-theme` on `<html>`. A small `ui/theme.ts` applies the setting and caches it in `localStorage` for the first paint.

**Tech Stack:** TypeScript strict, WXT MV3, React, CSS custom properties, Vitest.

**Spec:** [docs/superpowers/specs/2026-11-07-dark-mode-design.md](../superpowers/specs/2026-11-07-dark-mode-design.md)

## Global Constraints

- Light colours stay exactly as they are today; dark colours are the existing dark tokens in `extension/src/ui/tokens.css`.
- Default theme is `"system"`.
- `src/ui/**` imports no `worker.ts` or `src/worker/*`. The content script reads nothing from the page.
- No new dependencies or permissions. No comments unless the why is non-obvious.
- Commands: `export PATH=~/Library/pnpm:$PATH` first; gate is `pnpm typecheck && pnpm lint && pnpm test`, plus `pnpm build`.
- Subagents: only `git add <files>` and `git commit`; never stash, checkout, switch, reset, rebase, clean, restore, push. On a 1Password signing error, leave files staged and report.

## Review Focus

1. Stored settings from before this change (no `theme` key) must read as `"system"` (Task 1 test).
2. A junk `localStorage["plover-theme"]` value must not break a page (Task 1 `parseTheme` test).
3. Every token in the old `@media (prefers-color-scheme: dark)` block must keep its dark value in `light-dark()`. Tokens that had no dark override keep the light value for both.
4. The buddy bubble on a page must not inherit the page's `color-scheme` (Task 2: the wrap sets its own).

---

### Task 1: Setting and pure parsing

**Files:**
- Modify: `extension/src/shared/types.ts` (add `export type Theme = "system" | "light" | "dark"`, `Settings.theme: Theme`), `extension/src/shared/storage.ts` (`DEFAULT_SETTINGS.theme = "system"`)
- Create: `extension/src/shared/theme.ts` with `export function parseTheme(value: unknown): Theme`
- Test: `extension/tests/shared/theme.test.ts` (new), `extension/tests/shared/storage.test.ts`

- [ ] **Step 1: Failing tests:** `parseTheme("light") === "light"`, `parseTheme("dark") === "dark"`, `parseTheme("system") === "system"`, and `parseTheme(undefined)`, `parseTheme("blue")` and `parseTheme(3)` all return `"system"`. In storage, with `fakeBrowser.storage.sync.set({ settings: { workMinutes: 30 } })`, `(await getSettings()).theme === "system"`.
- [ ] **Step 2:** Run `pnpm --filter ./extension exec vitest run tests/shared` and confirm it FAILS.
- [ ] **Step 3:** Implement the code, then fix any `Settings` literal fixtures that typecheck flags.
- [ ] **Step 4:** Run the full gate; it should be green.

### Task 2: Tokens, theme plumbing, options control, bubble

**Files:**
- Modify: `extension/src/ui/tokens.css`: put `color-scheme: light dark` on `:root`. Rewrite each colour token as `light-dark(<light>, <dark>)`, taking dark from the current `@media` block; a token with no dark override uses its light value twice, or stays a plain value. Delete the `@media` block. Add `:root[data-theme="light"] { color-scheme: light; }` and `:root[data-theme="dark"] { color-scheme: dark; }`.
- Create: `extension/src/ui/theme.ts`:
  - `export function applyTheme(theme: Theme): void`: for `"system"`, delete `document.documentElement.dataset.theme`; otherwise set it. Write `localStorage.setItem("plover-theme", theme)` inside try/catch.
  - `export function applyStoredTheme(): void`: `applyTheme(parseTheme(localStorage.getItem("plover-theme")))` inside try/catch.
- Modify: `extension/src/ui/hooks/useExtensionState.ts`: `useEffect(() => applyTheme(settings.theme), [settings.theme])`.
- Modify: `extension/src/entrypoints/{popup,panel,options,welcome,blocked}/main.tsx`: call `applyStoredTheme()` before `createRoot`.
- Modify: `extension/src/entrypoints/options/main.tsx`: add a first `<section>` with `<h2>Appearance</h2>` and a `role="radiogroup"` `aria-label="Appearance"` of 3 radio inputs (labels `System`, `Light`, `Dark`, `name="theme"`), each calling `save({ theme })`. Under them, the helper `<p className="hint">Matches your computer's setting.</p>`, shown only when System is selected (reuse an existing hint/secondary-text class if there is one).
- Modify: `extension/src/entrypoints/options/options.css`: style the radio group as a segmented control. Use only existing tokens: `--color-border-control`, `--color-bg-quiet` for the selected item, and `--radius-control`.
- Modify: `extension/src/entrypoints/content/BuddyView.tsx`: add `data-theme={settings.theme === "system" ? undefined : settings.theme}` on `.plover-buddy-wrap`.
- Modify: `extension/src/entrypoints/content/buddy.css`:
  - `.plover-buddy-wrap { color-scheme: light dark; }`, plus `[data-theme="light"]` and `[data-theme="dark"]` overrides.
  - `.plover-bubble { background: light-dark(#fffdf9, #2f4236); color: light-dark(#2d2a26, #f3eee1); }`.

- [ ] **Step 1:** Implement all of the above.
- [ ] **Step 2:** Run the full gate and `pnpm build`; both should be green. Then `grep -n "prefers-color-scheme" extension/src` should return nothing.
- [ ] **Step 3:** Commit with message `feat(ui): appearance setting with light, system and dark`.
