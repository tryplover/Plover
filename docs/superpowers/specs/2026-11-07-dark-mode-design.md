# Appearance: light, system and dark

**Status:** Design. **Date:** 2026-11-07.
**Extends:** [pivot spec](2026-10-02-desktop-buddy-pivot-spec.md) §4 (popup, in-page panel, options).

## 1. Problem

Plover's pages already have dark colours: `ui/tokens.css` switches every colour token under `@media (prefers-color-scheme: dark)`. So today the extension follows the operating system and the user can't choose. Someone with a dark OS who wants a light Plover (or the reverse) has no way to get it.

Two surfaces also ignore dark mode entirely:
- The buddy's speech bubble on web pages (`content/buddy.css`) is hard-coded light (`#fffdf9` on `#2d2a26`).
- The in-page panel iframe follows the OS, not the user.

## 2. Goals and non-goals

**Goals**
1. A setting **Appearance: System / Light / Dark**, stored with the other settings in `chrome.storage.sync`.
2. Default **System**, which is exactly today's behaviour, so nobody's Plover changes on upgrade.
3. Every Plover surface honours it: popup, in-page panel, options, welcome, blocked page and the buddy's speech bubble.
4. A change applies at once in every open Plover surface, without a reload.

**Non-goals**
- No new palette work. The dark tokens in `tokens.css` are the dark theme. Light stays as it is.
- No theming of the buddy art. It's placeholder art, designed separately.
- No per-site themes, schedules (dark after sunset) or high-contrast mode.
- The toolbar icon and badge stay as they are.

## 3. Design decisions

### 3.1 Look

- **Light:** the current cream palette (`#f3eee1` surface, `#2f4236` text). Unchanged.
- **Dark:** the existing dark tokens, a deep forest green surface (`#2f4236`, page `#243329`) with cream text (`#f3eee1`) and sand secondary text (`#d9cfb4`). It is the light palette inverted, so the brand still reads as Plover rather than generic grey. Primary text on the surface is 9.3:1 contrast and secondary is 6.9:1, so both pass WCAG AA.
- **Speech bubble, dark:** surface `#2f4236`, text `#f3eee1`, with the same shadow. It sits on arbitrary web pages, so it keeps a strong shadow in both themes.

### 3.2 Control

On the options page, a new **Appearance** section sits at the top (it's the most visible preference), with three radio buttons styled as a segmented control: **System**, **Light**, **Dark**. Helper text under System says "Matches your computer's setting."

The popup gets no theme toggle. It's a once-in-a-while choice, and the popup is space-constrained.

## 4. How it works

### 4.1 Tokens: one declaration per colour

`tokens.css` replaces the duplicated `@media` block with CSS `light-dark()`:

```css
:root { color-scheme: light dark; --color-bg-surface: light-dark(#f3eee1, #2f4236); /* … */ }
:root[data-theme="light"] { color-scheme: light; }
:root[data-theme="dark"]  { color-scheme: dark; }
```

`light-dark()` picks its value from the element's `color-scheme`. `light dark` follows the OS, and the attribute pins it. That means one source of truth per token and no selector duplication. It needs Chromium 123+ (March 2024), which is fine because the extension targets current Chromium browsers. Native controls (checkboxes, scrollbars) follow `color-scheme` too.

### 4.2 Applying the setting

- `Settings.theme: Theme` where `type Theme = "system" | "light" | "dark"`, default `"system"`. Old stored settings have no `theme`. `getSettings` already spreads `DEFAULT_SETTINGS`, so they read as `"system"` and no migration is needed.
- Pure `parseTheme(value: unknown): Theme` in `shared/theme.ts` turns anything unknown into `"system"`.
- `ui/theme.ts` has two functions:
  - `applyTheme(theme)`: sets `document.documentElement.dataset.theme` for light or dark, removes it for system, and caches the value in `localStorage["plover-theme"]`.
  - `applyStoredTheme()`: reads that cache synchronously.
- Each extension page entry (`popup`, `panel`, `options`, `welcome`, `blocked`) calls `applyStoredTheme()` before `createRoot`, so the first paint already has the right theme. Extension pages share one origin, so they share the cache. MV3 CSP forbids inline scripts, so this is as early as we can run.
- `useExtensionState` calls `applyTheme(settings.theme)` whenever settings load or change. Every page already uses that hook, so all open surfaces update live.

### 4.3 Buddy bubble (content script)

The content script already reads settings through `useSyncedSettings`. That hook reads Plover's own settings, not the page, so it is allowed. `BuddyView` puts `data-theme` on `.plover-buddy-wrap` inside its Shadow DOM. `buddy.css` gives the wrap `color-scheme: light dark` and pins it by the attribute, the same way as §4.1. The bubble colours use `light-dark()`. Nothing is read from the page, and `prefers-color-scheme` is the browser's own setting.

### 4.4 Architecture fit

- Settings go through `updateSettings` from the options page, like every other preference. No worker change. The worker doesn't use the theme.
- `src/ui/theme.ts` touches only `document` and `localStorage` of extension pages. It imports no worker code.
- No new permissions, hosts or dependencies.

## 5. Testing

- **Unit:** `parseTheme` (each valid value, `undefined`, junk, so unknown values become `"system"`). `getSettings` returns `theme: "system"` for stored settings without the key.
- **Manual (screenshots in the PR):** popup, panel on a page, options and the blocked page in Light, Dark, and System under both OS settings. Switching in options updates an open popup or panel live. Reopen the popup to confirm there is no flash of the wrong theme. Check the bubble on a light site and a dark site in both themes.

## 6. Delivery

1. This design plus the plan (`docs/plans/dark-mode.md`).
2. Implementation: setting, `light-dark()` tokens, theme plumbing, the options control and the bubble. It's one small, atomic PR. Splitting it would leave a setting that does nothing, or tokens with no way to pin them.

⚠ PR #492 (Settings in its own tab) also edits `options/main.tsx`. The Appearance section is a self-contained `<section>`, so whichever lands second should rebase cleanly.
