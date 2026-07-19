# Plan: Repo cleanup (conservative dead-code sweep)

**Branch:** `chore/repo-cleanup` off `main`.
**Scope decision:** conservative — delete only clearly-dead code with zero references. Flag architecture violations, store-layer refactors, and file-splitting for follow-up PRs; do not attempt them here.

## Context

The Plover Electron app is mid-Phase 1. Four parallel audits (dead code, architecture, store/DB, general quality) surfaced ~40 findings. This plan executes only the subset that is safe under the conservative bar; the rest is captured in "Follow-ups (not in this PR)" below.

## What this PR does (dead code only)

### 1. Delete unreferenced overlay setup files

The old `QuickAdd`-based setup flow was replaced by the current `setup/` renderer flow. `main.tsx` no longer imports `QuickAdd`, and the four step components are only referenced by `QuickAdd`.

- Delete `app/src/renderer/overlay/QuickAdd.tsx`
- Delete `app/src/renderer/overlay/components/Step1GoalSetup.tsx`
- Delete `app/src/renderer/overlay/components/Step2TaskBreakdown.tsx`
- Delete `app/src/renderer/overlay/components/Step3WatchedSources.tsx`
- Delete `app/src/renderer/overlay/components/Step4Tracking.tsx`
- If `app/src/renderer/overlay/components/` ends up empty, delete the directory.

**Verification:** grep for `QuickAdd`, `Step1GoalSetup`, `Step2TaskBreakdown`, `Step3WatchedSources`, `Step4Tracking` across `app/src`, `app/tests`, and `app/index.html`. Expect zero hits after deletion.

### 2. Remove unused exports

- `app/src/shared/events.ts`: delete the `AppEvent` union type and `AppEventMap` interface (zero external consumers).
- `app/src/renderer/lib/motion.ts`: remove re-exports of `useReducedMotion`, `Variants`, `Transition` (zero consumers). Keep `motion` re-export (used by renderer).
- `app/src/renderer/main/icons/IconSun.tsx`: delete the file and remove it from `main/icons/index.ts` (not imported anywhere).
- `app/src/main/activity/index.ts`: delete the `getScreenCapturer()` export (unused). Keep the class/singleton wiring.
- `app/src/main/planner/deviation-detector.ts`: un-export `MissedBlock` interface (used only internally in the same file).

### 3. Remove dead repo/detector methods

- `app/src/main/store/repos/tasks.ts`: delete `TasksRepo.listScheduledBetween` and its prepared statement (`listScheduledBetweenStmt`). Zero non-test callers. Delete the corresponding test in `app/tests/store/tasks-repo.test.ts` if one exists for `listScheduledBetween`.
- `app/src/main/planner/deviation-detector.ts`: delete the `rescheduleTask` method (zero callers). Keep `runDeviationPass`.

### 4. Deduplicate `SummaryRow` type

- `app/src/main/store/repos/summaries.ts` re-declares `SummaryRow` verbatim from `app/src/shared/types.ts`. Delete the local declaration in `repos/summaries.ts` and import from `../../../shared/types.js`.

### 5. Drop unused dev dependency

- `app/package.json`: remove `@testing-library/jest-dom` from `devDependencies` (no `jest-dom` matchers or setup file references it).
- Run `pnpm install` at the repo root to update the lockfile.

## Verification

From repo root, in this exact order:

```
pnpm install
pnpm --filter ./app run typecheck
pnpm --filter ./app run lint
pnpm --filter ./app run test
```

All four must pass green. If a test referenced `listScheduledBetween` or one of the deleted overlay files, it will fail — deletion of that test is in-scope for this PR.

## Follow-ups (NOT in this PR — captured for later)

The audits surfaced these; each is deferred because it changes behavior, refactors architecture, or is a bigger design decision.

**Architecture (moderate scope):**
- `deviation-detector.ts` calls `new Notification(...).show()` and mutates Store from `planner/` — belongs in a nudge/deviation module.
- `activity/inference.ts` and `activity/git-commit-tracker.ts` mutate `tasks.status = 'done'` directly. CLAUDE.md says only task-owner code should write task rows; these should emit events.
- `sync/calendar.ts` `patchEventTitleForTask` / `deleteEventForTask` write to `TasksRepo`. Sync should only call Google APIs.
- HTTP allowlist promised in CLAUDE.md is not actually enforced in `app/src/main/http/authed-fetch.ts`. Either implement the check or update CLAUDE.md to reflect the proxy pattern as authoritative.
- Barrel exports: add `sync/index.ts`, `lifecycle/index.ts`, and re-export repo classes/types from `store/index.ts` so consumers stop deep-importing.

**Store/DB (moderate scope):**
- `saveGoalAndTasks` and `deleteGoalAndTasks` in `planner/goal-manager.ts` are not wrapped in transactions — partial-write risk.
- `tasks.goal_id` has no `ON DELETE CASCADE`; `goalsRepo.delete(id)` will abort if a caller forgets to pre-delete tasks.
- Squash v1–v4 migrations into a single init while pre-release.
- Drop redundant `idx_tasks_goal_id` (subsumed by v4 composite `idx_tasks_goal_sort`).
- Decide: delete `sessions` table + `SessionsRepo` until Phase 2 needs it, or leave as scaffold.
- Add `lastGDocsPollTime` to `SettingsData` type, or move it out of `settings`.
- Duplicate task-row `SELECT` + row-mapper repeated 5× in `tasks.ts` — extract `rowToTask`.

**Quality (aggressive scope):**
- Split `renderer/main/pages/Onboarding.tsx` (869 lines) into one file per step.
- Split `renderer/main/pages/Settings.tsx` (707 lines) — inline styles and duplicate blocks.
- Split `main/ipc.ts` (502 lines) by domain (goals, tasks, calendar, overlay, companion).
- Consolidate `CalendarPort` (in deviation-detector) with `CalendarSync` — one interface.
- Consolidate `getGoogleStatus(err)` helper across `sync/calendar.ts` error-handling blocks.
- Single `Settings` type in `shared/types.ts` (currently duplicated 3× in `preload/index.ts`).

## Non-goals

- No behavior changes. UI, IPC surface, and DB schema stay identical.
- No dependency version bumps beyond removing one unused dep.
- No new tests (except deleting tests for deleted APIs).

## Rollback

Everything in this PR is a pure deletion. Reverting the commit restores the exact prior state.
