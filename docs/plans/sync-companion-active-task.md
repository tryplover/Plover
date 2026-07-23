# Plan: sync the companion overlay's active task with Home

## Context

Branch: `feat/sync-companion-active-task-v2`, based on `origin/ui-fixes` — this is the
branch the user is actually running via `pnpm dev` from a second local checkout
(`D:\GitHub\Plover`). (A first attempt at this fix landed on a *different* branch,
`wip/liquid-glass-overlay`, before it was discovered the user tests against `ui-fixes`
instead — a separate, independently-restored copy of the companion feature with its own
commit history: `e645e5e` "fix: restore companion overlay deleted by dead-code cleanup",
plus later `ui-fixes`-only companion fixes. The two branches' companion code has already
diverged — don't assume anything from the first attempt carries over untouched; re-verify
against this branch's actual files.)

**The bug on this branch is more direct than originally diagnosed:** grepping
`app/src/renderer` for `setActiveTask` turns up the IPC *plumbing*
(`preload/index.ts`'s `CompanionApi.setActiveTask`, `global.d.ts`'s type, `ipc.ts`'s
`companion:setActiveTask` handler) but **zero callers** — nothing in `Home.tsx` or anywhere
else in the renderer ever invokes `window.api.companion.setActiveTask(...)`. So
`companionActiveTaskId` in `ipc.ts`'s closure never leaves its initial `null`, and
`companion:getInitialState()` always reports `activeTaskId: null`. The companion pill is
correctly reading its state — that state has just never been written. This isn't a
mount-lifecycle race to fix; it's dead wiring to replace.

**The fix (same design as before, now applied to real files):** make the companion
self-sufficient. It already has `getTasks`, `getTaskById`, `getTasksByGoal` on
`window.api`. Compute the active task directly in `useCompanionState`, refreshed on mount
and whenever `useAppEvents` fires (`goal.created`/`task.completed`/`task.scheduled`) —
matching how `Home.tsx` already computes and refreshes its own view of "the current task"
via `pickCurrentTask`. No dependency on Home being mounted, and no dependency on any
renderer ever remembering to push through IPC.

## Current file shapes on this branch (read these yourself before editing — this plan
summarizes, it does not replace reading the actual current source)

- `app/src/renderer/main/pages/Home.tsx` — has its own local `sortSiblings` +
  `TASK_STATUS_RANK` + `pickCurrentTask`, same logic as before. Note: this branch's Home is
  more evolved than the first attempt's base — it has `selectedGoalId` state (clicking a
  non-active goal card selects it and shows *its* current task instead of the global one via
  a second `pickCurrentTask(goalTasks)` call at line ~108), goal-level `isActive`/"WATCHING
  NOW" badges, and delete buttons. **Only touch the `sortSiblings`/`TASK_STATUS_RANK`/
  `pickCurrentTask` extraction — do not touch `selectedGoalId`, `goalCards`, or any of the
  newer UI logic.** There is no `companion.setActiveTask` call anywhere in this file to
  remove (unlike the first attempt's base) — nothing to delete here beyond the three
  extracted functions.
- `app/src/renderer/companion/useCompanionState.ts` — same shape as the original bug
  report: `getInitialState()` destructures `{ kind, activeTaskId }` and, if present, fetches
  the task; separately listens for a `companion:activeTask` push event. Both paths are
  correctly implemented but permanently starved of input since nothing pushes.
- `app/src/main/ipc.ts` — `companion:setActiveTask` handler + `companionActiveTaskId`
  variable both present (~line 358-413), same as before.
- `app/src/preload/index.ts` / `app/src/renderer/global.d.ts` — same `CompanionApi`/
  `PloverAPI.companion` shape with `setActiveTask` and `getInitialState(): { kind,
  activeTaskId }`.
- `app/tests/renderer/companion/useCompanionState.test.ts` — same placeholder-only tests
  (mocks `getTasks` but the hook is never actually rendered/asserted).
- `app/tests/renderer/App.test.tsx` — mocks `companion.getInitialState` with
  `activeTaskId: null` and `companion.setActiveTask`.

## Files to change

### 1. `app/src/shared/current-task.ts` (new)

Extract from `Home.tsx`: `sortByScheduledStart` (rename of the local `sortSiblings`),
`pickCurrentTask`, and the `TASK_STATUS_RANK` map + its comment, as pure exports importing
`Task` from `./types`.

### 2. `app/src/renderer/main/pages/Home.tsx`

Import `pickCurrentTask`/`sortByScheduledStart` from `../../../shared/current-task`; delete
the three local definitions. Do not change anything else — `selectedGoalId`, the second
`pickCurrentTask(goalTasks)` call at line ~108 (now using the imported function), goal
cards, and all rendering logic stay exactly as-is, just calling the shared function instead
of a local one.

### 3. `app/src/renderer/companion/useCompanionState.ts`

Same change as designed previously: replace the `getInitialState().activeTaskId` +
`companion:activeTask` handshake with a `refetchTask` callback (`getTasks()` →
`pickCurrentTask` (shared import) → if found, `getTasksByGoal` → `buildSteps`/
`stepsProgress`, reusing the existing helpers unchanged) called on mount and on every
`useAppEvents` firing. `companion:getInitialState()` is now only consulted for `kind`.
Remove the `companion:activeTask` listener. Keep `companion:state` untouched. Guard
`setView` calls after unmount with the same `active` flag pattern the effect already uses
elsewhere in this file (the first attempt's implementation missed this for the new
`refetchTask` path — a `useRef` for the mounted flag, shared between the effect and the
`useCallback`, is the straightforward way to thread `active` through both).

### 4. `app/src/main/ipc.ts`

Remove the `companion:setActiveTask` handler and `companionActiveTaskId` variable.
`companion:getInitialState` returns `{ kind: companionKind }` only.

### 5. `app/src/preload/index.ts` + `app/src/renderer/global.d.ts`

Remove `setActiveTask` from `CompanionApi`/`PloverAPI.companion` (type + preload bridge
implementation). Drop `activeTaskId` from `getInitialState()`'s return type in both files.

### 6. Tests

- `app/tests/renderer/companion/useCompanionState.test.ts`: replace the placeholder tests
  with real `renderHook`/`waitFor` (`@testing-library/react`, already a dependency)
  assertions: initial fetch picks the right task and builds steps/progress; no tasks → task
  null; a `companion:state` event still updates `kind`; an `app-event` `task.completed`
  triggers a refetch reflected in the hook's output.
- `app/tests/renderer/App.test.tsx`: drop the `setActiveTask` mock and `activeTaskId` field
  from the `companion` mock object.
- Grep `app/tests/` for any other reference to `setActiveTask` / `companionActiveTaskId` /
  `getInitialState`'s `activeTaskId` and update to match the trimmed surface.

## Out of scope

- Don't touch `companion:show`/`companion:hide`/`companion:resize`/`companion:setState`,
  `app/src/main/windows/companion.ts`, `selectedGoalId`/goal-card logic in `Home.tsx`, or
  add activity-monitoring-driven task detection (Phase 1 scope per `CLAUDE.md`).

## Verification

From repo root: `pnpm typecheck && pnpm lint && pnpm test`. Electron GUI can't be visually
verified through the Bash/PowerShell tool in this environment (documented in `CLAUDE.md`'s
lessons-learned) — the user will verify visually themselves via their own `pnpm dev` in
`D:\GitHub\Plover` once this branch's fix is available there (push + fetch, or the user
pulls the diff manually — flag this explicitly when reporting back, don't assume the fix is
visible to them just because it's committed on this machine).
