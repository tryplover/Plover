# Remove Inferred Progress Presentation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop showing any progress percentage, goal bar, progress line, pips, or percent pops in the app. Keep manual task status, the step list, and the current-task display. Progress will be communicated by a later stall nudge, not a bar.

**Architecture:** Progress is presented in three places: the Home goal cards (`GoalCard` + `Home.tsx`), the companion collapsed and expanded views (`Collapsed.tsx`, `Expanded.tsx`, `Companion.tsx`, fed by `useCompanionState.ts`), and the shared helper `app/src/shared/goal-progress.ts` (blends done count with the current task's `progress`). Remove the presentation and the helper. `task.progress` stays in the store and types (a later schema decision).

**Tech Stack:** React, TypeScript (strict), vitest + Testing Library (jsdom). No new dependencies.

**Spec:** `docs/superpowers/specs/2026-10-02-desktop-buddy-pivot-spec.md` (§5 non-goal "no AI progress"; §6 progress signals frozen). Scope source: `reports/pivot-removal-sweep-2026-10-10.md` item 10 and "Blended bars and task percentages" row; product decision from the user: scrap the inferred percentage, remove the goal bar, and use a stall nudge instead (separate later work).

**Stacking:** branch `chore/remove-inferred-progress-ui`, stacked on `chore/retire-ai-progress-nav` (PR #431). PR base is that branch.

## Global Constraints

- One purpose: remove progress presentation. No stall nudge, no replacement metric (decided against), no copy changes beyond the Home subtitle clause named below.
- Preserve: `task.progress` in `app/src/shared/types.ts`, the store, and the summaries/inference code (frozen); the `progressPopsEnabled` setting key and its Settings toggle (inert after this PR; removed with item 11); the manual status controls (complete, undo, switch, edit, reorder); the step list; `pickCurrentTask`; the `companion` state kinds (`observing`, `paused`, `done`, `not-sure`) and `StatusIndicator`.
- TypeScript strict; no comments unless WHY is non-obvious; no new deps. No dead code: unused imports, components, hooks, files, and CSS rules for removed classes go.
- pnpm: `export PATH=/Users/liyu.xiao/Library/pnpm:$PATH`. Per-file: `pnpm --filter ./app exec vitest run <path>`. Gate from repo root: `pnpm typecheck && pnpm lint && pnpm test`.
- Commit message ends with `Co-Authored-By: Claude Haiku 5.5 <noreply@anthropic.com>`. On 1Password "failed to fill whole buffer" retry the same commit; never `--no-gpg-sign`.

## Review Focus

- No element renders a percentage or progress line anywhere in Home or the companion: `grep -rn "Math.round(.*progress\|ProgressLine\|PercentPop\|plover-expanded__segments\|goalProgress\|useProgressPops" app/src` returns nothing except the frozen `AIProgress.tsx` if it matches.
- Home subtitle no longer mentions "closest to done"; with tasks in motion it reads "N task(s) in motion today."
- Expanded still shows the current task title and steps; Collapsed still shows the status indicator and current title.

---

### Task 1: Remove progress presentation and its helpers

**Files:**
- Delete: `app/src/shared/goal-progress.ts`, `app/tests/shared/goal-progress.test.ts`
- Delete: `app/src/renderer/components/ProgressLine/` (whole directory, including `ProgressLine.test.tsx`)
- Delete: `app/src/renderer/components/PercentPop/` (whole directory)
- Delete: `app/src/renderer/hooks/useProgressPops.ts` (only if no remaining importer; grep first and report any test importing it)
- Modify: `app/src/renderer/dev/ComponentGallery.tsx` (remove the ProgressLine section and its import; remove PercentPop if shown)
- Modify: `app/src/renderer/main/pages/Home/GoalCard/GoalCard.tsx` (remove `progress` and `progressPopsEnabled` and `pops` props, the `ProgressLine` row, the goal `%` span, the per-step `%` and `PercentPop`, and their imports; keep the step rows and the manual controls)
- Modify: `app/src/renderer/main/pages/Home/Home.tsx` (remove the `goalProgress` import; `goalCards` becomes goals with `isActive` only; remove `closestGoal`; subtitle becomes `N task(s) in motion today.` without the closest clause; remove `useProgressPops`, the `progressPopsEnabled` state and loader, its `loadExtra` use, and the `pops` prop)
- Modify: `app/src/renderer/companion/useCompanionState.ts` (remove `progress` from `CompanionView` and its `setView` assignments and `goalProgress` import; `refetchTask` keeps task and steps)
- Modify: `app/src/renderer/companion/Collapsed.tsx` (remove `ProgressLine` and the `%` spans in both compact and full modes; keep indicator and title)
- Modify: `app/src/renderer/companion/Expanded.tsx` (remove `progressPopsEnabled` prop, the `useProgressPops` call, the task `%` span, the goal `%` span, and the 6-pip segment row)
- Modify: `app/src/renderer/companion/Companion.tsx` (remove `progressPopsEnabled` state, its settings load, and the prop pass to Expanded)
- Modify the CSS file of each edited component only to delete rules whose class names no longer appear in the TSX (for example `plover-collapsed__pct`, `plover-expanded__pct`, `plover-expanded__segments`, `plover-expanded__task-progress`, `plover-home-task-row__progress`, `plover-home-task-row__pct`).
- Modify or delete tests that reference removed things (grep `app/tests` and `app/src/**/*.test.tsx` for `ProgressLine`, `PercentPop`, `goalProgress`, `useProgressPops`, `progressPopsEnabled`, `closest`).

**Interfaces:**
- Produces: `CompanionView` is `{ kind: StateKind; task: Task | null; steps: {...}[] }` (no `progress`). `GoalCard` props no longer include `progress`, `progressPopsEnabled`, or `pops`. `Expanded` props are `{ view, onCollapse }`.

- [ ] **Step 1: Write failing tests**

Add `app/src/renderer/companion/Expanded.progress.test.tsx` (jsdom, `// @vitest-environment jsdom`) that renders `<Expanded view={...} onCollapse={() => undefined} />` with a view whose task has `progress: 40`, companion `progress` is not part of the view type. Assert `container.textContent` does not match `/%/`, and that the task title is displayed. Mock `window.api` as needed for any hooks Expanded uses (look at how existing companion tests stub `window.api`; if none exist, stub only the calls that run on mount).

Add a test that renders `Home` or the Home subtitle logic with two tasks in motion and an active goal at partial progress, and asserts the text "closest to done" is absent. If rendering Home needs too much mocking, instead assert on the Home source via a unit test of the exported subtitle helper only if one exists; otherwise report the blocker and stop with BLOCKED rather than skipping the assertion.

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter ./app exec vitest run companion/Expanded.progress.test.tsx` (paths relative to `app/src/renderer` per the existing test layout; adjust to the real path the vitest config matches)
Expected: the `%` assertion FAILS (the percentage renders today). Report the exact failure.

- [ ] **Step 3: Remove the presentation**

Apply the Files list above. Keep TypeScript strict; the compiler will flag every missed prop or import.

- [ ] **Step 4: Run tests**

Run: `pnpm --filter ./app exec vitest run src/renderer tests/shared`
Expected: PASS. Then run the grep in Review Focus and report its output.

- [ ] **Step 5: Full gate and commit**

From repo root with real exit codes: `pnpm typecheck`, `pnpm lint`, `pnpm test`. Then:

```bash
git add -A app/src app/tests
git commit -m "fix(progress): remove inferred progress percentages and goal bars

Co-Authored-By: Claude Haiku 5.5 <noreply@anthropic.com>"
```

---

## Self-Review

- Spec coverage: sweep item 10 and the user's decision (scrap inferred percentage, remove goal bar) are covered by the removals and the grep check.
- Follow-ups (not this PR): stall nudge (separate PRs: spec amendment, status-change tracking, nudge delivery), `progressPopsEnabled` toggle removal (item 11), `task.progress` field retirement (schema decision).
