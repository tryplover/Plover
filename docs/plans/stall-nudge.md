# Stall Nudge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When a goal has open tasks and no manual status change for 24 hours, send one gentle nudge during working hours. Tracking uses manual status changes only. No inference, no model call, no activity data.

**Architecture:** Three stacked PRs, each green on its own. (1) Store: `tasks.status_changed_at`, set only by the manual `tasks:updateStatus` path, plus a pure stall rule. (2) Engine: a main-process driver that runs the rule on an interval and sends one notification per stall, with per-goal and per-day limits stored in settings. (3) Settings: a "Stall nudges" toggle in the Settings page.

**Tech Stack:** TypeScript (strict), better-sqlite3 migrations, vitest. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-10-02-desktop-buddy-pivot-spec.md` §4.7 (the stall definition, working-hours check, limits, generic text, off switch). CLAUDE.md "Stall nudge" line in the MVP list.

**Stacking:** Task 1 branch `feat/stall-nudge-store` is based on `main`. Task 2 is based on Task 1. Task 3 is based on Task 2. Note: `feat/mvp-timer` (PR #414) also adds migration version 8. Whichever lands second must take the next free version; this plan uses version 8 and the timer PR must renumber when it rebases.

## Global Constraints

- Manual status changes only. `status_changed_at` is set by the user-triggered `tasks:updateStatus` IPC path. It is NOT set by `TasksRepo.update` (used by inference, corrections, and the planner), and not by `incrementProgress`.
- Nudge text is generic and never names a window, file, site, or screen content. Naming the goal title is allowed; it is user-entered data. No model call anywhere in this feature.
- Stall rule (fixed): a goal is stalled when it has at least one task whose status is not `done` or `skipped`, and `now - max(status_changed_at over all tasks in the goal) >= 24h`.
- Check window (fixed): checks run only on weekdays (Mon–Fri) between `workingHours.start` and `workingHours.end` local time (use the existing settings `workingHours`, `"HH:MM"` strings). Check interval: every 15 minutes.
- Limits (fixed): at most one nudge per goal per stall (a stall ends when any task in the goal changes status); at most one nudge per local calendar day across all goals.
- Setting `stallNudgeEnabled`: boolean, default `true`.
- TypeScript strict; no comments unless WHY is non-obvious; no new deps. Do not change `TasksRepo.update`'s behaviour.
- pnpm: `export PATH=/Users/liyu.xiao/Library/pnpm:$PATH`. Per-file: `pnpm --filter ./app exec vitest run <path>`. Gate from repo root: `pnpm typecheck && pnpm lint && pnpm test`.
- Commit messages end with `Co-Authored-By: Claude Haiku 5.5 <noreply@anthropic.com>`. On 1Password "failed to fill whole buffer" retry the same commit; never `--no-gpg-sign`.

---

## Task 1: Store column, manual-status path, and the pure stall rule (PR 1)

**Files:**
- Modify: `app/src/main/store/db.ts` (append migration version 8)
- Modify: `app/src/main/store/repos/tasks.ts` (insert sets `status_changed_at`; new `setManualStatus`, new `listStallInputs`)
- Modify: the `tasks:updateStatus` handler in `app/src/main/ipc/tasks.ts` to call `setManualStatus`
- Create: `app/src/main/nudge/stall.ts`
- Create: `app/tests/nudge/stall.test.ts`
- Modify: `app/tests/store/` (add the repo test next to the existing tasks repo tests; find them with `grep -rln "TasksRepo" app/tests`)

**Interfaces:**
- Produces:
  - Migration v8: `ALTER TABLE tasks ADD COLUMN status_changed_at TEXT; UPDATE tasks SET status_changed_at = created_at;`
  - `TasksRepo.setManualStatus(id: string, status: Task['status'], at: Date): Task`
  - `TasksRepo.listStallInputs(): { id: string; goal_id: string; status: Task['status']; status_changed_at: string }[]`
  - `findStalledGoalIds(input: { now: Date; stallMs: number; tasks: { goal_id: string; status: Task['status']; status_changed_at: string }[] }): string[]` in `app/src/main/nudge/stall.ts`, returning goal ids in first-seen order.

- [ ] **Step 1: Write failing tests**

`app/tests/nudge/stall.test.ts`: test `findStalledGoalIds` directly with a fixed `now` and `stallMs = 24 * 60 * 60 * 1000`. Cases:
1. goal with one `todo` task changed 25h ago → returns that goal id.
2. same but changed 23h ago → `[]`.
3. goal whose only open task is `todo` changed 25h ago, plus a `done` task in the same goal changed 1h ago → `[]` (the done change counts as activity).
4. goal where all tasks are `done` or `skipped`, last change 48h ago → `[]`.
5. exactly 24h ago → included (boundary: `>=`).
6. two goals, one stalled, one not → only the stalled id.

Repo test: create a goal and a task through the repo, call `setManualStatus(id, 'in_progress', at)` with a fixed `at`, assert `get(id).status === 'in_progress'`, `listStallInputs()` shows `status_changed_at === at.toISOString()`, and that `update(id, { status: 'done' })` does NOT change `status_changed_at` (inference path). Check how existing tests construct the in-memory DB and FK fixtures (`plover-testing` skill: FK fixtures must seed the parent goal).

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter ./app exec vitest run tests/nudge tests/store`
Expected: FAIL (module and methods do not exist yet).

- [ ] **Step 3: Implement**

- Migration v8 in `db.ts` as above.
- `TasksRepo`: add `status_changed_at` to the insert (value = `created_at`), add the two methods. `setManualStatus` runs `UPDATE tasks SET status = ?, status_changed_at = ?, updated_at = ? WHERE id = ?` and returns `this.get(id)` (throw if null, as other repo methods do).
- `tasks:updateStatus` handler: call `tasksRepo.setManualStatus(id, status, new Date())` instead of the existing update call. Check the handler's current code first and keep its return value and validation the same.
- `stall.ts`: pure function, no imports from store or electron.

- [ ] **Step 4: Run tests**

Run: `pnpm --filter ./app exec vitest run tests/nudge tests/store tests/main`
Expected: PASS.

- [ ] **Step 5: Full gate and commit**

From repo root with real exit codes: `pnpm typecheck`, `pnpm lint`, `pnpm test`. Commit:

```bash
git add -A app/src app/tests docs/plans/stall-nudge.md
git commit -m "feat(nudge): record manual task status changes and add the stall rule

Co-Authored-By: Claude Haiku 5.5 <noreply@anthropic.com>"
```

---

## Task 2: Nudge engine and notification (PR 2, based on Task 1)

**Files:**
- Create: `app/src/main/nudge/engine.ts`
- Create: `app/tests/nudge/engine.test.ts`
- Modify: `app/src/main/store/repos/settings.ts` (add `stallNudgeEnabled`, default `true`, following the pattern of an existing boolean such as `planner_useRecentActivityContext`; add the `SettingsData` field and the setter path)
- Modify: `app/src/main/index.ts` (start the engine inside `app.whenReady` after `setupIpc`; stop it in `before-quit`)

**Interfaces:**
- Consumes: `findStalledGoalIds` (Task 1), `TasksRepo.listStallInputs` (Task 1), `GoalsRepo.get(id)`, `settingsRepo.getAll()`.
- Produces:
  - `class StallNudgeEngine { constructor(deps: { tasks: { listStallInputs(): StallInput[] }; goals: { get(id: string): { title: string } | null }; settings: { getAll(): { stallNudgeEnabled: boolean; workingHours: { start: string; end: string } }; get/set of the last-nudge map and last-nudge time }; notify: (title: string, body: string) => void; now: () => Date }); start(): void; stop(): void; check(now: Date): void }`
  - Last-nudge state: a JSON map `{ [goalId]: isoTime }` and the last-nudge ISO time, both persisted in settings (add two internal keys in `settings.ts` next to `stallNudgeEnabled`, not exposed in the Settings UI).

- [ ] **Step 1: Write failing tests** (`app/tests/nudge/engine.test.ts`, fake clock, injected deps, no timers; call `check(now)` directly)

Cases:
1. stalled goal, weekday 10:00 local, enabled → `notify` called once with title `Plover` and body containing the goal title and `Still on`.
2. second `check` the same day → no second notify.
3. next day, still no status change → no notify (per goal, the stall already nudged).
4. status change on a task in the goal (update `listStallInputs` to return a fresh time), then stalled again 24h later on a later weekday → notify again.
5. weekend (Saturday 10:00) or 07:00 weekday → no notify.
6. `stallNudgeEnabled: false` → no notify.
7. two stalled goals in the same check → only one notify (per-day limit), the other goal is not marked as nudged, so the next day it may be nudged.

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter ./app exec vitest run tests/nudge/engine.test.ts`
Expected: FAIL (engine does not exist).

- [ ] **Step 3: Implement**

- `check(now)`: return early unless enabled, weekday, and within working hours (parse `"HH:MM"`; compare minutes since local midnight; `start` inclusive, `end` exclusive). Compute stalled goal ids via `findStalledGoalIds({ now, stallMs: 24*60*60*1000, tasks: listStallInputs() })`. Load the nudge map. For each stalled goal, in order: skip if the map has a time for it that is `>=` the goal's latest status change (already nudged this stall); skip the rest of the loop once one notification has been sent today (per-day limit; compare the last-nudge time's local date with `now`'s local date). On send: `notify('Plover', \`Still on "${title}"? Pick the next step, or split it.\`)`, record `map[goalId] = now.toISOString()` and the last-nudge time, persist both.
- `start()`: `setInterval(() => this.check(this.now()), 15 * 60 * 1000)`, and call `check` once immediately. `stop()`: clear the interval. Use the existing `lifecycle/periodic.ts` helper if it fits; otherwise a plain interval stored on the instance.
- Wiring in `main/index.ts`: construct with the real repos, `now: () => new Date()`, and `notify` as `(title, body) => new Notification({ title, body }).show()` (same pattern as `activity/processing/commit-task-matcher/commit-task-matcher.ts`). Start it in `app.whenReady` after `setupIpc`; stop it in `before-quit`.

- [ ] **Step 4: Run tests**

Run: `pnpm --filter ./app exec vitest run tests/nudge tests/main tests/store`
Expected: PASS.

- [ ] **Step 5: Full gate and commit**

From repo root with real exit codes: `pnpm typecheck`, `pnpm lint`, `pnpm test`. Commit with message `feat(nudge): send one stall nudge per goal per stall` and the Haiku trailer.

---

## Task 3: Settings toggle (PR 3, based on Task 2)

**Files:**
- Modify: `app/src/renderer/main/pages/Settings/Settings.tsx` (load `stallNudgeEnabled`; add a toggle wired through the same auto-save path as `progressPopsEnabled`)
- Modify: the renderer and preload settings types (`app/src/renderer/global.d.ts`, `app/src/preload/index.ts`) only where `progressPopsEnabled` is declared, to add `stallNudgeEnabled: boolean`
- Modify: `app/tests/renderer/main/pages/Settings/Settings.test.tsx` (or the existing Settings test file; find it with `grep -rln "progressPopsEnabled" app/tests app/src --include='*.test.tsx'`)

**Interfaces:**
- Consumes: `settingsRepo` `stallNudgeEnabled` from Task 2.

- [ ] **Step 1: Write failing test**: render Settings with `getSettings` resolving `stallNudgeEnabled: true`, find the "Stall nudges" toggle, click it, assert `updateSettings` (or the existing auto-save mock) received `{ stallNudgeEnabled: false }`.
- [ ] **Step 2: Run to verify failure.** Expected: FAIL (no toggle).
- [ ] **Step 3: Implement** the toggle in the Settings page with the label "Stall nudges" and helper text "A gentle prompt when a goal sits untouched for a day." Keep it in the existing Settings layout; do not restructure sections.
- [ ] **Step 4: Run tests.** Expected: PASS.
- [ ] **Step 5: Full gate and commit** with message `feat(settings): add a stall nudge toggle` and the Haiku trailer.

---

## Self-Review

- Spec coverage: §4.7 items 1 (manual changes only, internal), 2 (stall rule), 3 (check window, one per stall, one per day), 4 (status change clears the stall), 5 (generic text, no model), 6 (Settings toggle) are covered by Tasks 1–3.
- Open decisions (defaults used, flag in the PR descriptions): default on for `stallNudgeEnabled`; goal title is included in the nudge text; a stall with no status change ever (new goal) counts from task creation.
- Follow-ups (not this plan): timer PR #414 migration renumbering, retiring `progressPopsEnabled` (sweep item 11), notification copy review (sweep item 12).
