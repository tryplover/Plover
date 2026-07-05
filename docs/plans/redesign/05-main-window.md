# PR-05 · Main window redesign

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development`.

**Goal:** Bring the main app window (sidebar + Today + Goals + Settings)
onto the same visual language as the overlay and companion. The
moodboard doesn't depict these pages directly, so this PR derives
their look from the established tokens, components, and the moodboard's
typographic voice (serif for display numerals and big section headings,
sans for body, mint for "live" affordances only).

**Architecture:** No new pages, no IPC changes. Rewrites the JSX and CSS
for `App.tsx`, `TasksToday.tsx`, `GoalsList.tsx`, `Settings.tsx`. Heavy
reuse of `StepRow`, `ProgressLine`, `StatusIndicator`, `Button`, `Chip`
from PR-02. Removes the emoji icons from the sidebar in favor of
single-glyph or monoline icons.

**Tech stack:** React, framer-motion, the PR-02 components.

## Global constraints

- No data-flow changes — every existing IPC call and state shape stays.
- No new pages. The bottom-left "Plover v1.0.0" version label stays
  (it's the user's only build-version cue).
- The sidebar's "active" affordance is mint, matching the moodboard's
  "observing" colour.
- The Today and Goals pages must still re-render on the existing
  `app-event` bus messages (`task.completed`, `task.scheduled`, etc.).

---

## Files

- Modify: `app/src/renderer/App.tsx` (top-level shell + sidebar).
- Modify: `app/src/renderer/main/pages/TasksToday.tsx`.
- Modify: `app/src/renderer/main/pages/GoalsList.tsx`.
- Modify: `app/src/renderer/main/pages/Settings.tsx`.
- Modify: `app/src/renderer/index.css` — remove rules made obsolete by
  the component library. Keep the `:root` token block (PR-01) intact.
- Test updates:
  - `app/tests/renderer/App.test.tsx` (new — sidebar interaction).
  - `app/tests/renderer/main/pages/TasksToday.test.tsx`
  - `app/tests/renderer/main/pages/GoalsList.test.tsx`
  - `app/tests/renderer/main/pages/Settings.test.tsx`

## Visual reference (derived from the moodboard)

Because the main window isn't pictured, treat these as design rules:

- **Page heading**: `Today`, `Goals`, `Settings` — Instrument Serif,
  weight 400, size `36px`, margin-bottom `28px`. Capitalize as shown.
- **Section card**: surface `var(--plover-surface)`, radius
  `var(--plover-radius-lg)`, padding `24px`, shadow none (interior
  cards don't float).
- **Task list row**: reuses `StepRow`. Status maps:
  - `task.status === 'done'` → `state="done"`
  - the next due task → `state="current"` + `now` trailing
  - everything else → `state="pending"`
- **Goal card**: title (sans 18/600) + `ProgressLine` underneath with
  fraction of completed subtasks. Expanding a goal shows its tasks as
  a vertical `StepRow` list.
- **Settings rows**: label (sans 14/500) + control on the right
  (Chip-like toggle, time picker, number input). Save status shows as
  a tiny mint dot + "Saved" in `var(--plover-text-muted)`.

## Tasks

### Task 05.1 — Sidebar rewrite (`App.tsx`)

- [ ] Remove the emoji icons. Replace with simple monoline SVG icons
  (sun for Today, target for Goals, gear for Settings). Inline the SVG
  in a small `app/src/renderer/main/icons/` folder, one file per icon,
  exported as React components. Each icon is `18px`, `stroke="currentColor"`,
  `stroke-width="1.5"`.

- [ ] Replace the gradient `P` logo with a small mint dot + serif
  wordmark `Plover`:

  ```tsx
  <div className="plover-brand">
    <span className="plover-brand__dot" aria-hidden />
    <span className="plover-brand__word">Plover</span>
  </div>
  ```

- [ ] Replace the existing `nav-item` button styling. Active item:
  background `var(--plover-mint-soft)`, text `var(--plover-text)`,
  a `2px` mint dot before the label. Hover: background
  `var(--plover-surface-raised)`. Use the existing badge for
  `todayPendingCount`.

- [ ] CSS adjustments in `index.css`: drop `.logo-icon`'s gradient,
  drop the indigo from `.nav-item.active`, replace with the spec
  tokens. Width of sidebar stays `240px`; padding can stay.

- [ ] Test `App.test.tsx` asserts: each tab button renders, clicking
  switches the active page (assert via `data-testid` on each page
  root that you add in subsequent tasks).

- [ ] Commit `feat(app): redesigned sidebar`.

### Task 05.2 — TasksToday rewrite

- [ ] Replace the body of `TasksToday.tsx` so it:

  - Renders `<h1>Today</h1>` (serif display).
  - For each goal that has tasks scheduled today, renders a section
    card: title (sans 18/600) on the left, `ProgressLine` on the
    right (`value = doneTasks / allTasks`).
  - Inside each section card, renders the goal's today-tasks as
    `StepRow` instances. Mark `done` from `task.status === 'done'`.
    The "current" row is the earliest `scheduled_start` that is not
    yet done.
  - Empty state: a small `StatusIndicator kind="not-sure"` with
    label `nothing scheduled` and a primary `Button` "Open setup
    overlay" that opens the overlay via the existing IPC.
  - Keeps the existing toggle-on-click behaviour for marking a task
    `done` ↔ `scheduled`. Hooking up `StepRow` to click: wrap each
    `<StepRow>` in a `<button>` with no chrome, so the row becomes
    a click target.

- [ ] Drop the existing emoji checkmarks and badges; rely on
  `StepRow`'s built-in state visuals.

- [ ] Tests: render with two mocked goals + tasks (via `vi.hoisted`
  IPC mocks), assert each goal card shows its progress fraction;
  click a row, assert `updateTaskStatus` is called.

- [ ] Commit `feat(today): match moodboard visual language`.

### Task 05.3 — GoalsList rewrite

- [ ] Replace the body of `GoalsList.tsx` so it:

  - Renders `<h1>Goals</h1>` (serif display).
  - "Add goal" surface stays at the top: a borderless input with the
    placeholder `What are you working on?` and a primary `Button`
    "Break into steps →". Calls the same `proposeGoal` IPC.
  - Decomposition preview keeps its existing data flow but renders
    as a section card with `StepRow` instances (same look as PR-04's
    `StepBreakdown`).
  - Goal list: each goal is a section card. Header shows title,
    `ProgressLine`, and a "▾"/"▸" chevron. Expanded body shows the
    goal's tasks as `StepRow`s and the existing schedule preview.
  - Deletion stays where it is (an `×` button at the row's right
    corner, hover-only).

- [ ] Tests: render with mocked goals, assert chevron toggles
  expansion; assert `proposeGoal` is called on submit and the preview
  renders; assert "Save" (commit) triggers `commitGoal`.

- [ ] Commit `feat(goals): match moodboard visual language`.

### Task 05.4 — Settings rewrite

- [ ] Replace the body of `Settings.tsx` so it:

  - Renders `<h1>Settings</h1>` (serif display).
  - Groups settings into three section cards: **Account**, **Working
    hours**, **Scheduling**.
  - Account: Google Connect button (primary), with a mint dot
    indicator next to "Connected as ..." when linked.
  - Working hours: a single row with two `<input type="time">`
    elements styled to match `--plover-surface-raised`.
  - Scheduling: horizon (`<input type="number">`) and pause toggle
    (a Chip-style toggle: `Paused` / `Active`).
  - Save indicator: replace the "Saving / Saved" text with a tiny
    mint dot + label in the page's top right.

- [ ] Tests: change working-hours time, assert `updateSettings`
  called; toggle pause Chip, assert state change persists; click
  Connect, assert `connectGoogle` IPC called.

- [ ] Commit `feat(settings): match moodboard visual language`.

### Task 05.5 — CSS cleanup

- [ ] Open `app/src/renderer/index.css`. Remove rules that are no
  longer referenced (search the rest of `src/renderer/` after the
  rewrites). Typical victims:
  - `.sidebar`, `.logo-icon`, `.nav-item`, `.badge` (re-add
    minimal versions if still referenced).
  - Anything tied to the indigo accent.
- [ ] Keep the `:root` token block from PR-01 intact.
- [ ] After cleanup, file should be ≤ `300` lines.

- [ ] Commit `chore(renderer): prune obsolete CSS`.

### Task 05.6 — Verification

- [ ] From repo root:

  ```bash
  pnpm typecheck && pnpm lint && pnpm test
  pnpm --filter ./app run test:coverage
  ```

- [ ] `pnpm dev`. Walk through:
  - Sidebar: tabs switch; active state is mint, not indigo.
  - Today: at least one goal with scheduled tasks renders as a
    section card with a progress line; clicking a task toggles done.
  - Goals: add a goal end-to-end via the inline form; expand a
    goal; delete a goal.
  - Settings: change working hours; toggle pause; Google Connect
    button reachable.
  - Overlay (PR-04) still opens via hotkey and visually fits.
  - Companion (PR-03) still opens and visually fits.

- [ ] Open PR `feat(main): redesign sidebar, Today, Goals, Settings`.

## Risks / footguns

- **Existing tests on Today/Goals/Settings** likely rely on the
  current class names and text. Update each test alongside the
  rewrite to keep the diff coherent within one PR.
- **`input[type=time]` styling** on macOS Electron is restricted —
  keep the input styled with our surface tokens but accept that the
  picker popup uses the OS chrome.
- **Removing CSS rules** can break the overlay/companion if they
  share class names. Search for every class you delete before
  removing it. None of the components from PR-02 share class
  prefixes with the legacy CSS (they all start with `plover-`), so
  collisions should be local to the main pages.
- **`noUncheckedIndexedAccess`** — when mapping tasks to rows, use
  destructure patterns; don't `!`. See CLAUDE.md lessons-learned
  `2026-06-12`.
