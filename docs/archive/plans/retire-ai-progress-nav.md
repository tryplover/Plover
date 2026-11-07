# Retire the AI Progress Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the "History" tab that opens the AI Progress page, so the primary app has only Home and Settings. The page, its IPC, and the summaries data stay in place.

**Architecture:** `app/src/renderer/App.tsx` owns the tab union (`'home' | 'progress' | 'settings'`), the nav button (`data-testid="nav-progress"`), and the render branch for `AIProgress`. Remove the button, the `'progress'` branch of the union and render, and the `AIProgress` and `IconActivity` imports (if `IconActivity` has no other user, delete its file and export). Nothing else routes to the tab (grep: no other `setActiveTab('progress')`).

**Tech Stack:** React, TypeScript (strict), vitest + Testing Library (jsdom). No new dependencies.

**Spec:** `docs/superpowers/specs/2026-10-02-desktop-buddy-pivot-spec.md` (§6: inference and progress signals frozen, "leave in place, don't extend, don't build on, don't delete yet"; §5: no AI progress). Scope source: `reports/pivot-removal-sweep-2026-10-10.md`, queue item 9 and "Remove from active behavior" row 4: "Retire this page from the primary experience. Coordinate with item 5 so historical summaries do not become a hidden route back to estimation."

**Stacking:** branch `chore/retire-ai-progress-nav`, stacked on `chore/setup-drop-window-picker` (PR #430). PR base is that branch.

## Global Constraints

- One purpose: remove the navigation route to the AI Progress page only.
- Preserve, do not delete: `app/src/renderer/main/pages/AIProgress/AIProgress.tsx` (frozen; deletion waits for the sweep's item 16 decision), the `summaries:*` IPC (`app/src/main/ipc/summaries.ts`, `app/src/main/ipc/settings.ts` `summaries:get`), the preload summary bindings, the `undo`/`reassign` decision (sweep: "resolve historical undo versus reassignment before a separate IPC cleanup"), the inference engine, Home and Settings.
- Not in this PR: Settings tracking UI (item 11), copy (item 12), the activity page (none exists).
- TypeScript strict; no comments unless WHY is non-obvious; no new deps. No dead code left by this change (unused imports; the `IconActivity` file only if nothing else imports it).
- pnpm: `export PATH=/Users/liyu.xiao/Library/pnpm:$PATH`. Per-file: `pnpm --filter ./app exec vitest run <path>`. Gate from repo root: `pnpm typecheck && pnpm lint && pnpm test`.
- If `tests/renderer/App.test.tsx` already fails on this branch before your change (the `plover-testing` skill lists pre-existing renderer failures), report the exact failure and whether it is pre-existing; do not fix unrelated tests.
- Commit message ends with `Co-Authored-By: Claude Haiku 5.5 <noreply@anthropic.com>`. On 1Password "failed to fill whole buffer" retry the same commit; never `--no-gpg-sign`.

## Review Focus

- The sidebar shows Home and Settings only; no element with `data-testid="nav-progress"` or `page-progress` exists.
- Selecting Home and Settings still works, and the default tab is Home.
- Nothing imports `AIProgress` any more except the frozen file itself (grep check).

---

### Task 1: Remove the History tab from the app shell

**Files:**
- Modify: `app/src/renderer/App.tsx`
- Modify: `app/tests/renderer/App.test.tsx` (the "renders all nav tabs" test)
- Possibly delete: `app/src/renderer/main/icons/IconActivity.tsx` and its export in `app/src/renderer/main/icons/index.ts`, only if no other file imports `IconActivity`

**Interfaces:**
- Produces: `type Tab = 'home' | 'settings'`. Nav renders Home and Settings buttons only.

- [ ] **Step 1: Update the test first**

In `app/tests/renderer/App.test.tsx`, in "renders all nav tabs": replace `expect(screen.getByTestId('nav-progress')).toBeTruthy();` with `expect(screen.queryByTestId('nav-progress')).toBeNull();`. Keep the other assertions.

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter ./app exec vitest run tests/renderer/App.test.tsx`
Expected: the nav test FAILS (the button is still rendered). If the file already fails before your edit for an environment reason (localStorage or similar), report it and state the failure is pre-existing; do not move on silently.

- [ ] **Step 3: Remove the tab**

In `App.tsx`:
- change `type Tab = 'home' | 'progress' | 'settings';` to `type Tab = 'home' | 'settings';`
- delete the nav `<button>` with `data-testid="nav-progress"`
- delete the `{activeTab === 'progress' && <AIProgress ... />}` render line
- delete the `AIProgress` import; remove `IconActivity` from the icons import
- check `IconActivity` usage with grep: if no other file imports it, delete `IconActivity.tsx` and remove its export from `app/src/renderer/main/icons/index.ts`

Do not delete `AIProgress.tsx`.

- [ ] **Step 4: Run tests**

Run: `pnpm --filter ./app exec vitest run tests/renderer src/renderer`
Expected: PASS (or only the pre-existing failures you reported in Step 2).
Then run `grep -rn "AIProgress\|nav-progress\|page-progress" app/src app/tests` and report the output; expected: only `AIProgress.tsx` itself and the new `toBeNull` assertion.

- [ ] **Step 5: Full gate and commit**

From repo root with real exit codes: `pnpm typecheck`, `pnpm lint`, `pnpm test`. Then:

```bash
git add -A app/src app/tests
git commit -m "fix(app): remove the AI Progress tab from the app shell

Co-Authored-By: Claude Haiku 5.5 <noreply@anthropic.com>"
```

---

## Self-Review

- Spec coverage: queue item 9 first half (retire the navigation and page from the primary experience) covered by the nav test and the grep check. The undo-versus-reassignment IPC decision is intentionally deferred and stated in Global Constraints.
- Follow-ups (not this PR): the undo/reassign IPC cleanup, deleting `AIProgress.tsx` (item 16), item 10 (percentage presentation).
