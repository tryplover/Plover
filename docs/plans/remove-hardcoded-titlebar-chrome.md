# Implementation Plan: Remove Hardcoded Titlebar Chrome

The onboarding window's custom titlebar draws its own red/yellow/green
circles to fake macOS traffic lights, even though the main process already
configures real native chrome for that window (`titleBarStyle: 'hiddenInset'`
on macOS, `titleBarOverlay` on Windows — see `app/src/main/index.ts:70-78`).
The result: on macOS, the OS draws real traffic lights in the inset corner
*and* the renderer draws fake ones in the same spot; on Windows the fake dots
are correctly suppressed but there is nothing to replace the `!isWindows`
check with — the branch just renders a spacer, which is already correct.

The Quick-Add overlay panel (`app/src/renderer/overlay/QuickAdd.tsx`) has a
related but distinct issue: its wizard-panel header draws the same
mac-styled traffic-light dots unconditionally on every platform. That window
is created with `frame: false` on all platforms (`variant: 'overlay'` in
`createOverlayWindow`, `app/src/main/index.ts:99-146`), so there's no native
chrome to fall back to — a custom close control is legitimate there. The fix
is to make that control platform-aware instead of removing it: mac styling
only on macOS, a plain functional close control on Windows.

Scope confirmed with user: fix both spots. No changes to
`app/src/main/index.ts` (window configuration is already correct) or to the
decorative "mockup window" graphic inside the onboarding content (that's a
product illustration, not real window chrome, and is out of scope).

---

## Proposed Changes

#### [MODIFY] [Onboarding.tsx](app/src/renderer/main/pages/Onboarding.tsx)

Around lines 118-127: remove the `!isWindows` conditional that renders
`plover-onboarding__dots` (three `<span>` circles). Always render just the
spacer div that reserves layout space — rename
`plover-onboarding__left-spacer` if useful, but the key change is that no
platform ever renders fake circle elements. macOS's real traffic lights are
drawn by the OS into that same reserved region automatically because of
`titleBarStyle: 'hiddenInset'`; nothing in the DOM needs to draw them.

Leave the `!isWindows` branch at lines 181-188 (`lang` vs
`right-container` + `win-overlay-spacer`) alone — that's reserving blank
space for Windows' real `titleBarOverlay` buttons, not drawing fake ones.

#### [MODIFY] [Onboarding.css](app/src/renderer/main/pages/Onboarding.css)

Remove the now-dead rules: `.plover-onboarding__dot`,
`.plover-onboarding__dot--red`, `.plover-onboarding__dot--yellow`,
`.plover-onboarding__dot--green`. Remove `.plover-onboarding__dots` from the
selector list at line 38 and its standalone rule at line 45 (replace with
whatever the unconditional spacer element ends up being named — reuse
`.plover-onboarding__left-spacer`'s existing width so the stepper doesn't
shift). Do not touch `.plover-onboarding__left-spacer`,
`.plover-onboarding__win-overlay-spacer`, `.plover-onboarding__right-container`,
or `.plover-onboarding__lang` — those are legitimate layout spacing, not fake
controls.

Leave `.plover-onboarding__mockup-dot*` rules (lines ~449-476) untouched —
those belong to the decorative product-mockup graphic inside the page
content, not real window chrome.

#### [MODIFY] [QuickAdd.tsx](app/src/renderer/overlay/QuickAdd.tsx)

Around lines 364-403 (the expanded wizard panel header, "Traffic lights"
comment): read `window.api.platform` the same way `Onboarding.tsx` does
(`const isWindows = window.api?.platform === 'win32';`). Keep the existing
three-dot mac-styled row (red dot `onClick={handleCancel}`, yellow/green
decorative) only when `!isWindows`. When `isWindows`, render a single plain
functional close control instead (no mac red/yellow/green coloring — e.g. a
small `×` button/glyph styled to match the panel's existing dark theme) that
calls `handleCancel` on click. Preserve the existing Escape-key close
behavior (`useEffect` at lines ~57-71) unchanged — it already works
cross-platform.

Do not touch `Step4Tracking.tsx`'s pulsing status dot (unrelated — it's a
tracking-state indicator, not a window control) or the step-progress dots at
lines ~420-445 in `QuickAdd.tsx` (those indicate wizard step 1/2/3, not
window chrome).

---

## Verification

1. `pnpm typecheck && pnpm lint && pnpm test` from repo root — must be green.
2. Manually launch the app (`pnpm dev`) and visually confirm:
   - Onboarding window: no fake circles render in the top-left on any
     platform; native chrome (traffic lights on mac / overlay caption
     buttons on Windows, if testable) is unaffected since main-process
     window config is untouched.
   - Quick-Add overlay (global hotkey): mac-styled dots only appear when
     `window.api.platform === 'darwin'`; clicking the close control (dot or
     `×`) still closes/collapses the panel via `handleCancel`.
3. Grep confirms no remaining references to
   `plover-onboarding__dot(--red|--yellow|--green)?` outside removed code,
   and no unconditional mac-colored (`#ff5f56`/`#ffbd2e`/`#27c93f`) elements
   remain in `QuickAdd.tsx` without a platform guard.
