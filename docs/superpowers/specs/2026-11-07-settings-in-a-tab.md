# Settings in its own tab, reachable from the buddy

**Status:** The bug fix is implemented on branch `claude/options-open-in-tab` (not merged). The rest is design, not implemented. **Date:** 2026-11-07.
**Extends:** [pivot spec](2026-10-02-desktop-buddy-pivot-spec.md) §4.7 (settings).

## 1. Problem

Clicking **Settings** in the popup "takes me back to Chrome's extension settings". The cause: the built manifest had `options_ui.open_in_tab: false` (WXT's default), so Chrome showed Plover's settings as a small embedded dialog inside `chrome://extensions`. It looks like Chrome's own page, cramped, with Chrome's extension list behind it.

Also:
- From the **in-page panel**, Settings opens the same embedded dialog, far from the page the user was on.
- The settings page itself is the first-pass layout (labels left, inputs right) and doesn't follow the Figma Settings screen (screen 8).

## 2. Fix (done)

`extension/src/entrypoints/options/index.html` gains `<meta name="manifest.open_in_tab" content="true" />`; the built manifest now has `"options_ui": { "page": "options.html", "open_in_tab": true }`. Settings opens as a normal Plover tab titled "Plover settings". Typecheck, lint and tests pass (233). Commit `5820d20` on `claude/options-open-in-tab`.

## 3. Design: settings page, Figma screen 8

Grouped into the Figma sections, using the existing tokens and components:

```
PLOVER · SETTINGS
Settings

FOCUS
Work block                          25 min  [−][+]
Short break                          5 min
Long break, every 4 blocks          15 min
Check in on me (focus nudge)   Every 15 min

BLOCKING
Blocked sites                [ 3 sites ▾ ]     (shared BlockList, see block-sites design)

WHERE PLOVER APPEARS
Show Plover on all sites            [ toggle ]  (see buddy-on-every-tab design)
Hide the buddy everywhere           [ toggle ]
Sites without the buddy        [ example.com ][Add]

CALENDAR
Google Calendar                     [Connect]
Warn me before meetings              5 min

KEYBOARD SHORTCUT
Open Plover: Alt+Shift+P   (change at chrome://extensions/shortcuts)

ACCOUNT
Signed in as you@example.com        [Sign out]
```

- Number fields become steppers with min/max (work 5–90, breaks 1–30, nudge 5–60) and save on change, as today.
- Rows use the Figma settings row (Label type left, value right, 51px rows, decorative divider).
- Leave out what the extension doesn't have: no "Show on desktop", "Sounds" or "Allow 5 more minutes" rows from the desktop-era Figma screen.
- "Warn me before meetings" exposes the existing fixed 5-minute heads-up as a setting (5 / 10 / off), as a new `Settings.headsUpMinutes`.

## 4. Implementation notes

- `entrypoints/options/main.tsx` is restructured into section components; the blocklist uses `BlockList` and site access uses the all-sites toggle from the other two designs.
- The settings link in the popup and the in-page panel keeps `runtime.openOptionsPage()`, which now opens or focuses the tab.
- `headsUpMinutes`: added to `Settings` with default 5; `calendar/worker.ts` reads it instead of `HEADSUP_LEAD_MS`. Tested.

## 5. Testing

- Build check: the manifest has `open_in_tab: true` (done).
- Playwright: Settings opens as `chrome-extension://…/options.html` in its own tab, renders all sections in light and dark, steppers clamp to their range.

## 6. Delivery

1. The open-in-tab fix (ready on `claude/options-open-in-tab`).
2. Settings layout per Figma, after the block-sites and buddy-on-every-tab components exist, so the page reuses them instead of duplicating them.
