# Drop Recent Activity from Decompose Requests Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop sending recent activity records (window titles, file paths, commit data) to `/api/decompose`, even when the saved `planner_useRecentActivityContext` setting is true (its default).

**Architecture:** `goal:propose` in `app/src/main/ipc/goals.ts` builds `recentActivity` from `activityRepo` and passes it to `decomposeGoal`, which forwards it in the request body. Remove the builder, the parameter, and the body field. The backend already treats `recentActivity` as optional, so no backend change.

**Tech Stack:** TypeScript (strict), vitest. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-10-02-desktop-buddy-pivot-spec.md` (§5 non-goals: no screen capture or window-title logging; §6 activity and inference frozen; task breakdown must not depend on activity). Scope source: `reports/pivot-removal-sweep-2026-10-10.md`, queue item 6, "Remove recent activity from task-decomposition requests".

**Stacking:** branch `chore/drop-activity-from-decompose`, stacked on `chore/stop-connector-pollers` (PR #417). PR base is that branch.

## Global Constraints

- One purpose: remove activity from decompose requests only.
- Preserve: `workingHours` in the request (backend requires it), the backend, the `planner_useRecentActivityContext` setting key and its Settings toggle (inert after this PR; UI removal is a later queue item), `activityRepo`.
- TypeScript strict; no comments unless the WHY is non-obvious; no new deps.
- pnpm: `export PATH=/Users/liyu.xiao/Library/pnpm:$PATH`. Per-file tests: `pnpm --filter ./app exec vitest run <path>`. Final gate from repo root: `pnpm typecheck && pnpm lint && pnpm test`.
- Lint: no empty-body stub methods in test classes; use expression-bodied fields. See `plover-testing` skill.
- Commit message ends with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. On 1Password "failed to fill whole buffer" retry the same commit; never `--no-gpg-sign`.

## Review Focus

- With `planner_useRecentActivityContext` true and activity rows present, `goal:propose` calls `decomposeGoal` with no `recentActivity` key. Pinned at the IPC level.
- The decompose request body carries only `goalText`, `now`, `workingHours`.
- Unused imports (`activityRepo`, `SettingsData`) fail lint and must go.

---

### Task 1: Remove recent activity from the decompose request

**Files:**
- Modify: `app/src/main/ipc/goals.ts`
- Modify: `app/src/main/planner/decompose.ts`
- Modify: `app/tests/planner/planner-decompose.test.ts`
- Modify: `app/tests/main/ipc.test.ts`

**Interfaces:**
- Produces: `decomposeGoal(input: { goalText: string; now: Date; workingHours: { start: string; end: string } })` with the same return type as today.

- [ ] **Step 1: Write failing tests**

In `app/tests/planner/planner-decompose.test.ts`, replace the two tests `forwards recentActivity to the backend request body` and `omits recentActivity from request body when not provided` with one test `sends only goal text, time, and working hours`: stub `fetch` as the existing tests do, call `decomposeGoal` with `goalText`, `now`, `workingHours`, parse the request body, and `expect(Object.keys(body).sort()).toEqual(['goalText', 'now', 'workingHours'])`.

In `app/tests/main/ipc.test.ts`, near the existing `handles goal:propose by generating a plan with subtasks` test, add a test that: enables the setting (`settingsRepo.update({ planner_useRecentActivityContext: true })` using whatever store access that file already uses; if the file mocks the store, follow its pattern), inserts one `activityRepo` row dated within the last hour (use the repo's existing insert method; follow how other tests seed it), invokes `goal:propose`, and asserts the mocked `decomposeGoal` was called with an argument that does not have a `recentActivity` property (`expect(arg).not.toHaveProperty('recentActivity')`).

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter ./app exec vitest run tests/planner/planner-decompose.test.ts tests/main/ipc.test.ts`
Expected: the new IPC test FAILS (`recentActivity` present). The decompose test passes or fails depending on type errors; if the file fails to compile because `recentActivity` is not yet removed from the type, that is acceptable. If the IPC test cannot seed activity or reach the settings under that file's mocks, report exactly why and stop with BLOCKED rather than weakening the assertion.

- [ ] **Step 3: Remove the wiring**

- `app/src/main/ipc/goals.ts`: delete `getRecentActivityContext`, the `recentActivity` constant and the spread `...(recentActivity ? { recentActivity } : {})`; drop the `activityRepo` and `SettingsData` imports.
- `app/src/main/planner/decompose.ts`: remove `recentActivity` from the input type and the `if (input.recentActivity ...)` block.

Touch nothing else (not settings, not the Settings UI, not backend).

- [ ] **Step 4: Run tests**

Run: `pnpm --filter ./app exec vitest run tests/planner tests/main`
Expected: PASS.

- [ ] **Step 5: Full gate and commit**

From repo root, real exit codes: `pnpm typecheck`, `pnpm lint`, `pnpm test` (3-4 min; long timeout). Then:

```bash
git add app/src/main/ipc/goals.ts app/src/main/planner/decompose.ts app/tests/planner/planner-decompose.test.ts app/tests/main/ipc.test.ts
git commit -m "fix(planner): stop sending recent activity to goal decomposition

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

## Self-Review

- Spec coverage: sweep item 6 (no recent activity in decompose requests) covered by the IPC test with the legacy flag on and a seeded row, and the body-keys test.
- Follow-ups (not this PR): the inert "Include recent activity" toggle and setting (Settings UI items), backend `routes/decompose.py` activity handling.
