# Popup and panel styling from the Figma design package

> **For agentic workers:** implement the tasks in order. Steps use checkbox (`- [ ]`) syntax. Run every command from the repo root.

**Goal:** The toolbar popup and the in-page panel (both render `ui/components/Panel.tsx`) currently have only layout CSS: system font, default browser buttons, white background. Style them to match the **App MVP** page of the Figma file "Plover — Design Package" (`9ArqIcaIijDNziBxmFBgV9`), using shared tokens that also restyle the welcome, options and blocked pages.

**Scope:** styling, plus the small markup changes needed to apply it (class names, an eyebrow line, a heading, the buddy in the popup). **No behaviour changes.** Do not add features from the Figma screens that the extension doesn't have (window "— ✕" controls, break screen, "Up next", calendar heads-up card, Settings rows such as "Show on desktop" or "Sounds").

## Global constraints

- Plain CSS files, no Tailwind, no CSS-in-JS. No new dependencies.
- `src/ui/**` must not import worker code (ESLint enforces it).
- Keep every existing visible label and placeholder unless a step says otherwise; tests may query them. Before changing any text, `grep -rn "<text>" extension/tests`.
- No comments unless the WHY is non-obvious.
- `pnpm typecheck && pnpm lint && pnpm test` green at the end of each task.

## Design reference (from Figma, already extracted; don't re-fetch)

**Font:** Lexend. Use `design/brand/fonts/lexend.woff2` (OFL, licence alongside it).

**Type styles** (size / weight / line-height):
- Section 20 / 500 / 1.35
- Body 16 / 400 / 1.6
- Label 14 / 500 / 1.4
- Caption 12 / 400 / 1.5
- Brand action 19 / 700 / 1.3
- Timer 40 / 500 / 1.2, letter-spacing -0.8px, tabular numbers
- Eyebrow (title bar) = Caption, uppercase, letter-spacing 1.44px

**Colour tokens** (light; dark under `@media (prefers-color-scheme: dark)`):

| token | light | dark |
|---|---|---|
| `--color-bg-page` | `#F3EEE1` | `#243329` |
| `--color-bg-surface` | `#F3EEE1` | `#2F4236` |
| `--color-bg-quiet` | `#D9CFB4` | `#243329` |
| `--color-text-primary` | `#2F4236` | `#F3EEE1` |
| `--color-text-secondary` | `#2F4236` | `#D9CFB4` |
| `--color-border-decorative` | `#D9CFB4` | `rgba(217,207,180,0.25)` |
| `--color-border-control` | `#5E7F6B` | `#D9CFB4` |
| `--color-action-compact-bg` | `#2F4236` | `#F3EEE1` |
| `--color-action-compact-fg` | `#F3EEE1` | `#2F4236` |
| `--color-action-brand-bg` | `#5E7F6B` | `#5E7F6B` |
| `--color-text-on-brand` | `#F3EEE1` | `#F3EEE1` |
| `--color-status-error` | `#9A453C` | `#E7B6AE` |
| `--color-focus` | `#2F4236` | `#F3EEE1` |

**Radii:** `--radius-control: 8px`, `--radius-card: 14px`, `--radius-panel: 20px`, `--radius-pill: 999px`.

**Components:**
- **Button / Compact** (primary): height 44, padding 0 20px, radius control, bg compact-bg, text compact-fg, Label type.
- **Button / Brand** (once per view, the big start action): height 52, padding 0 28px, radius control, bg brand-bg, text on-brand, Brand-action type.
- **Button / Secondary**: height 44, padding 0 20px, radius control, 1.5px border border-control, transparent bg, text primary, Label type.
- **Button / Text**: height 44, padding 0 20px (0 when inline at the start of a row is fine), no border or bg, text primary, Label type, underlined (`text-underline-position: from-font`).
- All buttons: `cursor: pointer`; disabled = opacity 0.5, `cursor: default`; `:focus-visible` outline 2px solid `--color-focus`, offset 2px.
- **Text input:** 1.5px border border-control, radius control, padding 12px 16px, Body type, bg transparent, text primary, width 100%.
- **Checkbox:** 20×20, `appearance: none`, 2px border border-control, radius 6px. Checked: bg brand-bg with the Figma tick (`extension/src/ui/assets/tick.svg`, provided below) as a centred background image.
- **Task row:** min-height 48, padding 12, gap 12, radius control, flex row, Body type. States: *Default* plain; *Now* bg bg-quiet plus a trailing `NOW` label (Caption, letter-spacing 1.44px); *Done* checked box and the title at opacity 0.7 (no strike-through). Step lists have 4px gap.
- **Chip:** 1px border border-decorative, radius pill, padding 6px 12px, Caption type, `display: inline-flex`, `align-self: flex-start`.
- **Toggle row** (from Figma Settings): label (Label type) on the left, a 36×20 pill switch on the right (track border-control at 40% opacity when off and brand-bg when on; 16px knob, cream). Build it by styling the existing `<input type="checkbox">` with `appearance: none`, not with a new component.
- **Panel screen:** bg bg-surface, padding 16px 24px 24px, flex column, gap 16px. Popup width 360px. Card shadow in Figma (`0 16px 40px -12px rgba(36,51,41,0.18)`, 1px border border-decorative, radius panel) applies only to the in-page panel, not the popup window.

Screens to match (for a reviewer's eyes): Idle (`7:2`), Break it down (`7:31`), Focus block (`7:72`), Check-in (`7:109`).

## Task 1 — tokens, font, base styles

### Files
- Create `extension/src/ui/assets/fonts/lexend.woff2` (copy of `design/brand/fonts/lexend.woff2`) and `extension/src/ui/assets/fonts/lexend-OFL.txt` (copy of the licence).
- Create `extension/src/ui/assets/tick.svg` (contents below, verbatim).
- Create `extension/src/ui/tokens.css`: `@font-face` for Lexend (`font-display: swap`, `font-weight: 100 900` if the file is variable, otherwise 400), and the custom properties above on `:root`, dark values in `@media (prefers-color-scheme: dark) { :root { … } }`.
- Modify `extension/src/ui/base.css`: `@import "./tokens.css";`; `body` gets bg `--color-bg-page`, colour `--color-text-primary`, `font-family: Lexend, system-ui, sans-serif`, Body type. Base element styles for `button` (= Button / Secondary), `input[type=text|email|password|number]` (= text input), `input[type=checkbox]` (= checkbox), `a` (colour text-primary, underline), `[role="alert"]` (colour status-error, Label type). Add the button variant classes `.plover-btn-compact`, `.plover-btn-brand`, `.plover-btn-text`, plus `.plover-chip`, `.plover-eyebrow`, `.plover-heading` (Section type, margin 0) and `.plover-toggle` (toggle row).
- Modify `extension/src/entrypoints/options/options.css`, `welcome/welcome.css`, `blocked/blocked.css`, `panel/panel.css`: replace hard-coded colours (`#fffdf9`, `#2d2a26`, `#b3261e`, …) with the tokens; delete rules that base.css now covers. `panel.css` keeps `margin: 0` and uses `--color-bg-surface`.
- Modify `extension/src/entrypoints/popup/main.tsx` and `panel/main.tsx`: import `@/ui/base.css` (the popup imports nothing today).

`tick.svg`:

```svg
<svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M5 10.5L8.5 14L15 6.5" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" stroke="#F3EEE1"/></svg>
```

### Steps
- [ ] Add the files above. Reference the font and tick from CSS with relative `url(...)`; Vite bundles them.
- [ ] `pnpm build`, then confirm `extension/.output/chrome-mv3` contains the woff2 and that no CSS references an `http(s)://` URL (fonts must not come from Google: that host isn't on the outbound allowlist).
- [ ] `pnpm typecheck && pnpm lint && pnpm test`.

## Task 2 — popup and in-page panel

### Files
- `extension/src/ui/components/Panel.tsx`, `Panel.css`, `TaskBreakdown.tsx`, `TimerControls.tsx`, `CheckIn.tsx`, `SignIn.tsx`, `CalendarNext.tsx`, `SiteAccess.tsx`.

### Steps
- [ ] **Screen.** `.plover-panel` follows *Panel screen* above; `.plover-surface-popup` width 360px. `.plover-surface-buddy` gets the card look (radius panel, border, shadow) and `min-height: 100vh`, `box-sizing: border-box`.
- [ ] **Eyebrow.** First child of the panel: `<p className="plover-eyebrow">`, text by `local.timer.phase`: idle → `Plover · Today`; work → `Focus · Work block` when `local.focus.on`, else `Work block`; shortBreak / longBreak → `Break`. (The uppercase comes from CSS.)
- [ ] **Buddy in the popup.** Only for `surface === "popup"` (the page already shows the buddy next to the in-page panel): render `<Buddy state={buddy} />` from `@/ui/components/Buddy`. When idle, centre it in a row, width 120px. When the timer runs, the timer row is a flex row with the clock block on the left (flex 1) and the buddy at 72px on the right. Check `Buddy.css` for how its size is set before overriding it; size it with a wrapper class, don't edit Buddy.css.
- [ ] **Idle (TaskBreakdown).** Add `<p className="plover-heading">What are you working on?</p>` above the input. If no test depends on the placeholder, change it to `e.g. Write the intro of my essay`; otherwise keep it. Before steps exist: "Suggest steps" → `.plover-btn-compact`, "Write my own" → `.plover-btn-text`. Actions rows have a 16px gap and centred items.
- [ ] **Editing steps.** Each `<li>` is a task row with the step input filling the row (the input keeps its border) and the ↑ ↓ × buttons as 32×32 `.plover-btn-text` icon buttons (no underline, padding 0). "Add step" → `.plover-btn-text`; "Start" → `.plover-btn-brand`.
- [ ] **Running (Panel's step list).** Each step `<li>` is a task row: *Now* for `currentStep` (add the trailing `<span className="plover-now">Now</span>`, uppercased by CSS), *Done* for `s.done`, otherwise *Default*. The checkbox and title stay inside the existing `<label>`; make the label `display: flex; gap: 12px; flex: 1; align-items: center`. Task title (`.plover-task`) uses the Section type.
- [ ] **TimerControls.** `.plover-clock` = Timer type. `.plover-phase` = Caption type, rendered below the clock (swap the order in JSX). Pause/Resume → `.plover-btn-compact`, Skip and Stop → `.plover-btn-text`.
- [ ] **Focus mode / Block sites now.** Each `<label className="plover-focus">` becomes a toggle row (`.plover-toggle`): label text on the left, the switch on the right (put the input after the text in JSX).
- [ ] **CheckIn.** The question is `.plover-heading`. Each open step button is a task-row-styled button (left-aligned, Body type, a 20px empty check box drawn with a `::before`, full width, transparent bg, hover bg-quiet). "None yet" → `.plover-btn-text`.
- [ ] **CalendarNext** → `.plover-chip`. **ConflictOffer** (`.plover-conflict`): bg bg-quiet, radius card, padding 16px, gap 12px; "Shorten…" → `.plover-btn-compact`, "Start anyway" → `.plover-btn-text`. **Nudge** (`.plover-nudge`): same box as the conflict, Body type.
- [ ] **SignIn.** "Continue with Google" → `.plover-btn-compact`, full width. The form is a column with 8px gap; its submit button stays Secondary (base `button`). "Create an account" toggle → `.plover-btn-text`. The `.plover-banner` "Sign in again" button → `.plover-btn-text`.
- [ ] **Links.** The Settings button and SiteAccess's "Show Plover on this site" (`.plover-link`) → Text-button look, `align-self: flex-start`.
- [ ] Delete Panel.css rules that the new styles replace; nothing still uses `system-ui` as the only font.
- [ ] `pnpm typecheck && pnpm lint && pnpm test`, and fix any test that broke only because of a markup move (don't weaken assertions).

## Verification (orchestrator)

```bash
pnpm typecheck && pnpm lint && pnpm test
```

```bash
pnpm build
```

Then load the build in Playwright Chromium (scratchpad `drive.js`) and compare screenshots of the popup (signed out, idle, steps, running, check-in), the in-page panel, the options page, the welcome page and the blocked page against Figma screens `7:2`, `7:31`, `7:72` and `7:109`, in light and dark (`colorScheme: "dark"`).
