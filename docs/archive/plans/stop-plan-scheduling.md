# Stop Scheduling at Plan Creation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** New plans no longer assign times to steps. Goal proposal and commit stop calling the scheduler; new tasks start as `todo`; the companion orders steps by their order in the plan.

**Architecture:** Three places assign times today: `goal:propose` in `app/src/main/ipc/goals.ts` calls `scheduleTasks` and returns slots; `goal:commit` passes the slots to `saveGoalAndTasks` in `app/src/main/planner/goal-manager.ts`, which stores them and sets status `scheduled`; `useCompanionState.ts` sorts steps by `scheduled_start`. Remove the first two and switch the sort to `sort_index`. `planner/schedule.ts` and its tests stay in place, frozen, with no caller in app code.

**Tech Stack:** TypeScript (strict), vitest. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-10-02-desktop-buddy-pivot-spec.md` §5 non-goal "No auto-scheduling into working-hours windows". Scope source: `reports/pivot-removal-sweep-2026-10-10.md` item 13. Product decision (2026-10-15): phase 1 is app-side only; the backend contract changes later.

**Stacking:** branch `chore/stop-plan-scheduling` is stacked on `chore/retire-tracking-settings` (PR #437), which the companion and Settings changes depend on. PR base is that branch.

## Global Constraints

- Keep sending `workingHours` to `/api/decompose`. The backend requires it until plover-server changes (phase 2, separate repo). Do not remove the `workingHours` argument from `decomposeGoal`.
- Keep `app/src/main/planner/schedule.ts` and `app/tests/planner/planner-schedule.test.ts` unchanged. Frozen code, not deleted.
- Keep the working-hours setting and the scheduling settings section (horizon, pause). Those are phase 3.
- Do not migrate or clear existing tasks. Tasks already saved with `scheduled_start` keep their times, and Home's status toggle logic stays as is.
- TypeScript strict; no comments unless WHY is non-obvious; no new deps. No dead code: unused imports, parameters, and listeners introduced by this change go.
- pnpm: `export PATH=/Users/liyu.xiao/Library/pnpm:$PATH`. Per-file: `pnpm --filter ./app exec vitest run <path>`. Gate from repo root: `pnpm typecheck && pnpm lint && pnpm test`. On this machine add `NODE_OPTIONS=--no-experimental-webstorage` to the gate (Node 26 localStorage issue that also affects main); CI on Node 22 is the reference.
- Commit message ends with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. On 1Password "failed to fill whole buffer" retry the same commit; never `--no-gpg-sign`.

## Review Focus

- `goal:propose` never calls `scheduleTasks`, and its response has no `scheduled_start` or `scheduled_end` on any subtask.
- `goal:commit` on a plan with no times creates tasks with status `todo`, `scheduled_start` and `scheduled_end` null, and `sort_index` matching plan order.
- The companion's step list follows plan order (`sort_index`), including for tasks that do have legacy times.
- `task.scheduled` is no longer emitted at commit (grep shows no emit left for new plans).

---

### Task 1: Stop assigning times at plan creation

**Files:**
- Modify: `app/src/main/ipc/goals.ts` (remove the `scheduleTasks` import and call, the `mockTasks` build used only for scheduling, the slot mapping in `goal:propose`, and the `slotsForSave` build in `goal:commit`; call `saveGoalAndTasks` with no slots)
- Modify: `app/src/main/planner/goal-manager.ts` (drop the `scheduledSlots` parameter, the slot lookup, the `scheduled_*` input fields, the `'scheduled'` status branch, and the `task.scheduled` emit and listener if nothing else uses them)
- Modify: `app/src/shared/events.ts` and `app/src/renderer/hooks/useAppEvents.ts` only if `task.scheduled` has no remaining emitter (grep first; if the listener remains necessary for legacy events, keep it and report why)
- Modify: `app/src/renderer/companion/useCompanionState.ts` (sort siblings by `sort_index`, then id)
- Modify: the renderer and preload `ProposedPlan` subtask types (`app/src/preload/index.ts`, `app/src/renderer/global.d.ts`) and `app/src/renderer/overlay/steps/StepBreakdown/StepBreakdown.tsx` to remove `scheduled_start` and `scheduled_end` from proposed subtasks
- Modify tests: `app/tests/main/ipc.test.ts`, `app/tests/planner/goal-manager.test.ts`, `app/tests/renderer/companion/useCompanionState.test.ts` (or the file that covers the companion sort; find it with `grep -rln useCompanionState app/tests`)

**Interfaces:**
- Produces: `saveGoalAndTasks(goalInput, subtaskInputs)` (two arguments). `ProposedPlan.subtasks[]` has `title`, `estimate_minutes`, `depends_on`, and no scheduling fields.
- Consumes: the existing `TasksRepo.create` (which accepts optional scheduled fields; leave the repo as is).

- [ ] **Step 1: Write failing tests**

(a) In `ipc.test.ts`, the `goal:propose` test: assert `scheduleTasks` (the mock already exists) was not called and the returned subtasks have no `scheduled_start` key.
(b) In `goal-manager.test.ts`: call `saveGoalAndTasks` with two subtasks and no slots; assert both tasks have `status` `'todo'`, `scheduled_start` falsy, and `sort_index` 0 and 1 in plan order.
(c) In the companion test: two tasks in one goal, task B has an earlier `scheduled_start` than task A but a higher `sort_index`; assert the step list is ordered A then B.

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter ./app exec vitest run tests/main/ipc.test.ts tests/planner/goal-manager.test.ts` and the companion test file.
Expected: (a) FAILS (scheduleTasks called), (b) FAILS (status `scheduled` or call signature), (c) FAILS (ordered by scheduled_start). Report the exact failures.

- [ ] **Step 3: Implement** the changes listed in Files. Keep `planner/schedule.ts` untouched.

- [ ] **Step 4: Run tests**

Run: `pnpm --filter ./app exec vitest run tests/main tests/planner src/renderer/companion` (or the companion test path). Expected: PASS. Then run `grep -rn "scheduleTasks" app/src --include='*.ts' --include='*.tsx'` and report: expected only the frozen `planner/schedule.ts` definition, with no callers.

- [ ] **Step 5: Full gate and commit**

From repo root with real exit codes: `pnpm typecheck`, `pnpm lint`, `pnpm test` (with the webstorage flag on this machine). Then:

```bash
git add -A app/src app/tests docs/plans/stop-plan-scheduling.md
git commit -m "fix(planner): stop assigning times to new plan steps

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

## Self-Review

- Spec coverage: sweep item 13 phase 1 (no scheduling at plan creation) is covered by the three tests and the callers grep. Backend and settings removal are separate phases in the plan's Global Constraints.
- Follow-ups (not this PR): phase 2 plover-server drops the `workingHours` requirement; phase 3 removes the scheduling settings section; `planner/schedule.ts` deletion is a later decision (item 16).
