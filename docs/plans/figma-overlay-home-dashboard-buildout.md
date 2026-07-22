# Plan: Figma-driven UI buildout — overlay polish, Home Dashboard, window picker

## Context

Figma file: `https://www.figma.com/design/JSg9zi7iLYFO7e4CfjSPfj/Plover-—-Desktop-Overlay--Moodboard---UI-`
(fileKey = `JSg9zi7iLYFO7e4CfjSPfj`)

The file has 9 top-level sections (① Collapsed State, ② Expanded State, ③ Setup Flow, ④
State Set, ⑤ Components, ⑥/⑦ retrofit instances, ⑧ prototype captions, ⑨ AI-work states),
a P1–P7 prototype flow, an O0–O9 onboarding flow, and 3 Home Dashboard frames (H, H2, H5).
This plan covers a bounded first slice — not the whole file.

**Survey of current app state** (`app/src/renderer/`): there is no router; `main.tsx`
branches on `?variant=` to mount `App` (main window), `Overlay` (quick-add pill / setup
window), `SignupScreen`, or a separate `companion/` Vite entry (`companion.html` →
`Companion.tsx` → `Collapsed.tsx`/`Expanded.tsx`) for the floating status pill. Onboarding
(`main/pages/Onboarding.tsx`) is large and functional, recently re-themed dark
(commit `daf5f83`). `GoalsList.tsx` is the de facto "Today" page (dark). There is no Home
Dashboard page. The "choose which window to watch" step exists only as a disabled, static
mockup inside Onboarding — real IPC for it (`window.api.listActiveWindows()`) already
exists and is unused by any real UI.

## Decision made without user confirmation (flag for review)

Asked the user whether to (a) follow Figma's light/cream theme for onboarding + Home
Dashboard, reverting the recent dark-theme onboarding commit, or (b) keep dark and adapt
Figma to it — and how much of the file to build now vs. later. No answer was given, so
per auto-mode I proceeded with defaults: **follow Figma's light/cream theme, but scope it
narrowly to the new Home Dashboard shell only — do not touch `Onboarding.tsx` or its dark
styling in this pass.** Overlay/Companion stays dark (matches Figma ①②③ already). **Tell
the user this was an unconfirmed judgment call** when reporting back; a full onboarding
re-theme is an easy follow-up if they want Figma matched everywhere.

## Scope for this pass (3 independent work-streams, disjoint files)

### A. Companion pixel polish (Collapsed + Expanded) — dark theme, matches Figma ①②

Figma nodes to reference (fetch via `get_design_context`/`get_screenshot` with
fileKey `JSg9zi7iLYFO7e4CfjSPfj`):
- `3:15` "Collapsed / Full" — collapsed pill, expanded-width state
- `3:42` "Collapsed / Compact" — collapsed pill, compact state
- `4:2` "Expanded / Default" — the expanded card (header, title, %, segment bar, steps,
  watching footer)

Files: `app/src/renderer/companion/Collapsed.tsx`, `Collapsed.css`, `Expanded.tsx`,
`Expanded.css`. Do not touch any other files (Home Dashboard, SetupFlow, onboarding, or
`index.css` `:root`).

Known gaps vs. current implementation (verify against the fetched design context, don't
just trust this list):
- `Expanded.tsx` header currently has one `···` button; Figma `4:8` shows a **pause icon**
  (two bars, node `4:9`) separate from a **3-dot overflow menu** (node `4:12`). Split into
  two elements. The pause icon can call the existing
  `window.api.companion.setState('paused')` (already used elsewhere in this file for the
  same purpose) — the dots menu can be a no-op / visual only, there's no menu content
  designed yet.
- Segment bar (`.plover-expanded__segments`) — confirm exact colors/gap/corner-radius
  against `4:21` `segment-bar` in Figma (filled segments look cream/off-white, unfilled
  look dark gray — verify actual hex via the design context response, don't eyeball the
  screenshot).
- Compare collapsed-pill spacing/typography against `3:15`/`3:42` and adjust
  `Collapsed.css` if it drifts (e.g. progress line thickness/cap, dot size, gap between
  status/title/%).

This is a pixel-diff pass, not a rewrite — the component structure is already close to
Figma. Preserve all existing IPC wiring (`window.api.companion.*`).

### B. New Home Dashboard page — light/cream theme, replaces default landing tab

Figma nodes:
- `100:418` "H · Home Dashboard" — populated state (greeting, "Start a task", tasks
  grouped by One-off/Daily/Weekly with progress bars, one row highlighted as
  actively-watched)
- `103:418` "H2 · Home (empty state)" — no tasks yet
- `125:433` "H5 · Home Dashboard — Active Focus + Steps Expanded" — same as H but with the
  active task's step list expanded inline (checkmarked done steps, current step, "Hide
  steps" toggle, "Only this window is watched — nothing is saved." caption)

**Theme scoping — important:** `app/src/renderer/index.css`'s `:root` block defines the
dark tokens (`--plover-bg`, `--plover-surface`, etc.) and is shared by every document that
imports it, including the overlay and companion windows (they're separate `BrowserWindow`
documents, but all compile the same `index.css`, so editing `:root` directly would also
relight the overlay/companion, which must stay dark). **Do not edit the `:root` block.**
Instead add a new scoped override, e.g. a `.plover-shell--light` class (or
`[data-theme="light"]` attribute) applied only to the post-onboarding `.app-container` in
`App.tsx`, redefining the same custom-property names within that scope
(`--plover-bg`, `--plover-sidebar-bg`, `--plover-surface`, `--plover-surface-raised`,
`--plover-border`, `--plover-text`, `--plover-text-muted`, `--plover-text-dim`,
`--plover-button-primary`, `--plover-button-primary-fg`) to the cream/warm values shown in
Figma (sample the real hex from the fetched design context — don't guess from the
screenshot). Since existing components (`Button`, `ProgressLine`, `StatusIndicator`,
`Chip`) already consume these var names rather than hardcoded colors, scoping the override
this way should re-theme them for free inside the Home Dashboard without a full rewrite.
Leave `Onboarding.tsx` completely alone (it renders before `.app-container` exists and
keeps the dark `:root` defaults).

**Data reality check (important, verified by reading `app/src/shared/types.ts` and
`GoalsList.tsx`):** `Goal`/`Task` have no `frequency` field — the `StepName` setup step
already collects `frequency: 'one-off'|'daily'|'weekly'` into local draft state, but
`ProposedPlan`/`commitGoal` (`app/src/preload/index.ts`) silently drops it; nothing
persists it today. There's also no stored "which task/window is being watched" — the
companion's own `watching` field (`useCompanionState.ts`) is permanently `null` in the
current code (never populated by any real event), and its `progress` is a hardcoded
`0.65` placeholder. Goal-level progress in `GoalsList.tsx` is computed client-side as
`doneTasks.length / goalTasks.length`, not stored.

Given that, **do not fabricate One-off/Daily/Weekly section headers from data that
doesn't exist** — that would show fake grouping to the user. Do not add a `frequency`
column/migration either; that's schema/backend work and out of scope here. Instead:
1. New `app/src/renderer/main/pages/Home.tsx` + `Home.css`. Fetch goals/tasks the same way
   `GoalsList.tsx` does (`window.api.getGoals()`, `window.api.getTasks()`,
   `useAppEvents` for refetch-on-change — reuse this pattern, don't invent a new one).
   Render one flat list of goal-cards (Figma's visual card shape: title, computed
   `doneTasks.length / goalTasks.length` progress via `ProgressLine`, reuse existing
   component) — skip the frequency section headers/counts entirely for this pass. Note in
   a one-line comment that the frequency grouping is deferred pending a `frequency` field
   on `Goal` (real, non-obvious reason a future reader would otherwise wonder about).
   Determine the "currently active/watched" goal using the **real** signal that does
   exist — `window.api.companion.getInitialState()` returns `{ activeTaskId }`; look up
   that task's `goal_id` and give that one goal-card the mint-highlighted treatment plus
   an inline expandable step list (reuse `StepRow`) toggled by "Hide steps"/"Show steps",
   matching `H5`. Do not show a "watching this window" subtitle/badge with an app name —
   there's no real data source for that anywhere in the app yet (the companion's own
   `Expanded.tsx` footer for this is unreachable today for the same reason), so don't
   invent one just for this page.
2. Empty state (`H2`): centered illustration text ("A calm place for your work." + body +
   "Start your first task" button) when there are zero tasks.
3. "Start a task" / "Start your first task" button opens the existing `SetupFlow` in a
   modal — copy the modal pattern already used in `GoalsList.tsx` (`showSetupModal` state
   + conditionally rendering `<SetupFlow onClose={...} />`), don't build a new modal
   primitive.
4. Sidebar: in `App.tsx`, relabel the nav to match Figma's `Home / All tasks / History`
   (plus `Settings` and a user-profile row at the bottom, per `H`/`H2`/`H5`). Reuse the
   existing icon components where they still make sense
   (`app/src/renderer/main/icons/`); add a simple new inline-SVG icon only if none of the
   existing three fit "Home" — keep it as minimal as `IconTarget`/`IconGear`. Map:
   - `Home` → new `Home.tsx` (default active tab)
   - `All tasks` → existing `GoalsList.tsx`, unchanged logic — just make sure it doesn't
     look broken sitting under the same (now-light) sidebar; if `GoalsList.tsx`'s own
     content still hardcodes dark surface colors instead of the shared `--plover-*`
     tokens, that's a pre-existing issue — leave it for a follow-up pass, don't scope-creep
     into rewriting `GoalsList.tsx`'s visuals here.
   - `History` → existing `AIProgress.tsx`, same note as above.
   - `Settings` stays as-is.
   Apply the `.plover-shell--light` scope class to `.app-container` itself so all four
   tabs sit inside the light shell (sidebar chrome, background) even though `All
   tasks`/`History`'s inner content may still visually lag Figma until a later pass.

Files: `app/src/renderer/App.tsx`, new `app/src/renderer/main/pages/Home.tsx` + `.css`,
`app/src/renderer/index.css` (additive only — new scoped class block, do not touch
`:root`). Do not touch `Onboarding.tsx`, `companion/`, or `overlay/`.

### C. Real "choose window to watch" step — completes the Setup Flow

Figma nodes:
- `17:89` "overlay-panel" — step 3 of the compact/overlay-style setup flow
- `17:243` "window-panel" — step 3 of the roomier window-style setup flow
(Both show the same content: "Which window should I watch?", a list of candidate
windows via `AppRow`-shaped rows with a mint checkmark on the selected one, a muted
"Deeper integrations — coming soon" row, Back / "Start tracking →".)

Current state: `app/src/renderer/overlay/SetupFlow.tsx` only has 2 real steps
(`name` → `breakdown`) before immediately calling `commitGoal` and closing. The
`AppRow` component (`app/src/renderer/components/AppRow.tsx`) already renders exactly
this row shape and already takes `onWatch`/`selected`. The IPC
`window.api.listActiveWindows(): Promise<{ app: string; title: string }[]>` already
exists and is currently unused by any real screen (only a hardcoded fake list appears
inside the Onboarding carousel mockup, which is intentionally inert — leave that mockup
alone, it's illustrative onboarding copy, not the real flow).

Work:
1. New `app/src/renderer/overlay/steps/StepConnect.tsx` + `.css`. On mount, call
   `window.api.listActiveWindows()` and render each result as an `AppRow` (single-select;
   clicking an unselected row selects it, matching the Figma checkmark/`Watch` states —
   look at how `ComponentGallery.tsx` already exercises `AppRow` for the expected
   selected/unselected visuals). Include the static "Deeper integrations... coming soon"
   row from Figma as inert copy. Back button returns to the breakdown step. Primary button
   reads "Start tracking →" and is disabled until a window is selected; on click it should
   do whatever `SetupFlow.tsx` currently does when `breakdown`'s `onNext` fires
   (`window.api.commitGoal(plan)` then close) — move that call here instead. Check
   `ProposedPlan` (`app/src/preload/index.ts`) for whether it already has a field for the
   watched window; if not, don't extend the main-process/store schema to add one (that's
   backend scope, deferred) — just keep the selection as local UI state so the step is
   genuinely clickable/functional even though the selection isn't persisted yet, and leave
   a one-line comment at the call site noting the selected window isn't wired to
   `commitGoal` yet pending backend design.
2. Update `app/src/renderer/overlay/SetupFlow.tsx`: add `'connect'` to the `Step` union
   between `'breakdown'` and `'committed'`; `StepBreakdown`'s `onNext` now moves to
   `'connect'` instead of calling `commitGoal` directly; render `StepConnect` for that
   step.
3. Update `app/src/renderer/overlay/steps/Stepper.tsx` (or its usage in `SetupFlow.tsx`)
   so the step indicator accounts for 3 steps instead of 2 (`current` prop currently maps
   `name→1, breakdown→2`; add `connect→3`).

Files: `app/src/renderer/overlay/SetupFlow.tsx`, `overlay/steps/StepConnect.tsx` (new)
+ `.css` (new), `overlay/steps/Stepper.tsx` (only if it hardcodes a step count). Do not
touch `Onboarding.tsx`'s mockup, `companion/`, or `Home.tsx`.

## Explicitly out of scope for this pass

- Onboarding O0–O9 re-theme/rebuild (kept dark, as recently committed).
- ④⑥⑦⑨ (state-set/retrofit/AI-work-state reference frames) — these are Figma
  documentation frames for the design system, not standalone screens to build.
- ⑤ Component library frame — reference only; the app's existing `components/` already
  covers these primitives.
- P1–P7 prototype flow — reference for future wiring, not a new screen.
- Any backend/store/schema changes (e.g. persisting the watched window, "active focus"
  task marking) — user wants clickable UI now, backend is a separate discussion.
- Full light-theme pass over `GoalsList.tsx`/`AIProgress.tsx`/`Settings.tsx` internals —
  only the shared shell (sidebar/background) goes light in this pass.

## Follow-up (requested mid-session): always-visible "liquid glass" companion overlay

New requirement from the user: the Companion pill should be a persistent, always-visible
overlay pinned near the top of the screen — not something that only appears when
explicitly toggled — styled with an Apple-style "liquid glass" translucent material
(blur + saturation + specular highlight), and it should stay on top of everything,
including fullscreen apps and other virtual desktops/spaces.

**Finding while investigating:** the Companion window is currently dead code in terms of
being shown — `createCompanionWindow()` (`app/src/main/windows/companion.ts`) is already
positioned near the top-right of the screen (`workArea.y + 24`), frameless, transparent,
`alwaysOnTop: true`. But nothing in the renderer ever calls
`window.api.companion.show()` — grepped the whole `app/src` tree, zero matches. So today
the companion window is only ever created lazily via IPC handlers in
`app/src/main/ipc.ts` (`companion:show`/`companion:setActiveTask`/etc.), and nothing
triggers `.show()`. It has to be made to auto-show at app launch.

### D. Main-process: auto-show + persistent-overlay window behavior

Files: `app/src/main/windows/companion.ts`, `app/src/main/ipc.ts`, `app/src/main/index.ts`.
Disjoint from all renderer work above — safe to run in parallel.

1. In `companion.ts`: strengthen `alwaysOnTop` to the `'screen-saver'` level
   (`win.setAlwaysOnTop(true, 'screen-saver')`) so it floats above fullscreen apps and
   other always-on-top windows, not just normal windows. Add
   `win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })` (macOS/Linux — a
   no-op harmlessly on Windows) so it doesn't disappear when the user switches spaces or a
   window goes fullscreen. On Windows 11, add `backgroundMaterial: 'acrylic'` to the
   `BrowserWindow` constructor options (guarded by `process.platform === 'win32'` — this
   option is additive to the existing `vibrancy`/`visualEffectState` mac options, doesn't
   replace them). Keep everything else (size, transparency, frameless, position) as-is —
   it's already positioned near the top of the screen.
2. In `ipc.ts`/`index.ts`: currently `companion` and `ensureCompanion()` are private to a
   closure inside `setupIpc`. Lift enough of that so `index.ts`'s `app.whenReady()` handler
   can create-and-show the companion window at startup, the same way it already does for
   `createMainWindow()`/`overlayWindow`. The cleanest path: export `ensureCompanion` (or a
   thin wrapper) from `ipc.ts` and call `.show()` on it once, right after `setupIpc(...)`
   is called in `index.ts`'s `whenReady()` block — mirroring the existing
   `createMainWindow(); overlayWindow = createOverlayWindow('overlay');` lines right below
   it.
3. **Known limitation, explicitly out of scope for this follow-up:** making the app behave
   like a true background/menu-bar app (tray icon, surviving `window-all-closed`, no dock
   icon) is a separate, larger change to app lifecycle/quit behavior. This pass only makes
   the companion auto-show alongside the main window and stay on top persistently while
   the app is running — it does not change what happens when the user closes the main
   window (existing `window-all-closed` quit behavior on non-mac is untouched). Flag this
   to the user as a likely next step if they want "always running" behavior, not just
   "always on top while running."

### Extension to work-stream A (Companion pixel polish): liquid glass material

The agent already assigned to `app/src/renderer/companion/Collapsed.css` and
`Expanded.css` (work-stream A above) should fold in the liquid-glass visual treatment on
top of its existing pixel-fidelity pass: real `backdrop-filter: blur(...) saturate(...)`
(already partially present — check current values against a proper "liquid glass" look:
stronger blur, subtle white specular gradient border/inner highlight
(`box-shadow: inset 0 1px 0 rgba(255,255,255,0.4)`-style top edge highlight is a common
technique), soft outer shadow for depth. Keep it performant — avoid layering more than 1-2
blur passes. This is additive to, not a replacement for, matching the Figma dark pill
design already fetched from nodes `3:15`/`3:42`/`4:2`.

## Verification

Each subagent should run `pnpm typecheck && pnpm lint` scoped to what it touched before
reporting done. After all three land, the orchestrator runs
`pnpm typecheck && pnpm lint && pnpm test` from repo root, then a manual read of the diff.
UI verification via a live `pnpm dev` run is not reliably possible from this environment
(see CLAUDE.md lessons-learned "Electron GUI can't be launched for visual verification via
Bash/PowerShell tool on this Windows box") — ask the user to eyeball it in `pnpm dev`
themselves for final visual sign-off.
