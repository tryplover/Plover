---
name: plover-electron-windows-overlay
description: Use when an Electron overlay/setup window opens the wrong content or renders wrong visually — e.g. clicking "Open setup overlay" opens a duplicate full main-app window (sidebar/tabs) instead of the setup/overlay flow, a transparent frameless BrowserWindow renders as a solid black rectangle instead of frosted glass/translucent on Windows, or a companion/overlay window is positioned in the wrong corner instead of top-center.
---

# Plover Electron overlay/window footguns

## Overview
Footguns specific to secondary/overlay `BrowserWindow`s in this app (the setup overlay and the companion pill): renderer-side variant routing, and Windows-specific transparency/positioning of frameless windows.

## Quick reference
| Symptom / error | Fix |
|---|---|
| Clicking "Open setup overlay" opens a new window that renders the full main app (sidebar/tabs) instead of the setup/overlay flow | In `main.tsx`, match both `"overlay"` and `"window"` as overlay/setup variants when parsing the `variant` query param, not just a substring check for `"overlay"` |
| Transparent, frameless, `alwaysOnTop` `BrowserWindow` renders as a solid black rectangle instead of a translucent/glass pill on Windows | Set `backgroundColor: '#00000000'` explicitly on the `BrowserWindow` constructor options in `app/src/main/windows/companion.ts` — don't rely on `transparent: true` alone |
| Overlay/companion window appears in the top-right corner instead of centered at the top | Position with `workArea.x + Math.round((workArea.width - COLLAPSED_WIDTH) / 2)`, `workArea.y + 12` instead of a hardcoded right-edge offset |

## Details

### Setup overlay opens duplicate main window
**Symptom:** In the "Today" page empty state, clicking "Open setup overlay" opens a new window, but the window renders a duplicate of the main application (with sidebar/main tabs) rather than the setup/overlay flow.
**Root cause:** The setup flow window is loaded with `?variant=window`. `main.tsx` determined whether to render `<Overlay />` (setup/overlay steps) or `<App />` (main application layout) by checking if `window.location.search` includes the literal string `"overlay"`. Since `variant=window` does not contain `"overlay"`, it incorrectly fell back to rendering `<App />`.
**Fix:** Parse the `variant` query parameter in `main.tsx` and match both `"overlay"` and `"window"` variants as the overlay/setup flow.

### Transparent BrowserWindow renders solid black on Windows
**Symptom:** A frameless, `transparent: true`, `alwaysOnTop: true` companion overlay window (`app/src/main/windows/companion.ts`) rendered as a solid black rectangle on a Windows 11 machine instead of the intended frosted-glass translucent pill, and was positioned in the top-right corner instead of top-center.
**Root cause (transparency):** This was the first time the companion window had ever actually been shown to a user — `window.api.companion.show()` had existed as dead IPC plumbing with no caller until it was wired up. A pre-existing but never-exercised transparency setup hit a known Electron/Windows footgun: on some Windows systems, a `transparent: true` `BrowserWindow` created *without* an explicit `backgroundColor` falls back to an opaque black backing surface for the native win32 window class instead of a genuine per-pixel-alpha one (see electron/electron#40515). `resizable: true` is a separate known trigger for the same symptom (not the cause here — this window already had `resizable: false`). Disabling hardware acceleration app-wide is another commonly-cited workaround but has too broad a blast radius (affects every window's rendering) to reach for by default.
**Fix:** Set `backgroundColor: '#00000000'` explicitly on the transparent `BrowserWindow`'s constructor options — don't just omit `backgroundColor` and assume `transparent: true` alone is enough on Windows. If a transparent overlay window still renders opaque after that, check next (in order): whether `resizable` is accidentally `true`, whether the user is on a remote/virtualized session where DWM composition may be degraded, and only as a last resort whether `app.disableHardwareAcceleration()` is needed (accept the app-wide rendering-quality tradeoff explicitly with the user before adding it).

**Root cause (positioning):** Was hardcoded to the top-right corner (`workArea.x + workArea.width - COLLAPSED_WIDTH - 24`).
**Fix (positioning):** Changed to horizontally centered at the top (`workArea.x + Math.round((workArea.width - COLLAPSED_WIDTH) / 2)`, `workArea.y + 12`) per explicit user feedback that a top-right corner pill read as "not centered" / misplaced once actually visible on screen — this app's design intent for this overlay is a persistent top-center bar, not a corner toast.
