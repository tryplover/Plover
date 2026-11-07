# Remove the Setup Flow Window Picker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the "Which window should I watch?" stage from the task setup flow and the `window:list-active` IPC behind it. Goals still commit when the user presses Start on the breakdown step.

**Architecture:** `SetupFlow` runs name, breakdown, connect, committed. The connect step (`StepConnect`) lists open windows, but the selection is never sent anywhere (its own comment says so), and its `handleStart` is the only caller of `commitGoal` from that flow. Move the commit to the breakdown step's transition, delete the connect step, and remove the IPC handler, preload binding, and renderer type that only it used.

**Tech Stack:** React, TypeScript (strict), vitest + Testing Library (jsdom). No new dependencies.

**Spec:** `docs/superpowers/specs/2026-10-02-desktop-buddy-pivot-spec.md` (§5: no window-title logging or screen capture; §6: activity frozen). Scope source: `reports/pivot-removal-sweep-2026-10-10.md`, queue item 8: "Remove the setup flow's watched-window selection stage; preserve plan commit."

**Stacking:** branch `chore/setup-drop-window-picker`, stacked on `chore/onboarding-no-screen-permission` (PR #419). PR base is that branch.

## Global Constraints

- One purpose: remove the window picker and its IPC. No copy changes (item 12), no Settings or tracking UI changes (item 11), no StepName/StepBreakdown redesign.
- Preserve: `get-windows` in `app/package.json`. The frozen window tracker (`app/src/main/activity/sources/system/window-tracker/window-tracker.ts`) still imports it, so the dependency stays.
- Preserve: `commitGoal` IPC and the `goal:commit` handler; the plan commit itself; the window variant chrome; the `Tracking started.` copy (item 12).
- TypeScript strict; no comments unless WHY is non-obvious; no new deps. No dead code: unused imports, types, and files go.
- pnpm: `export PATH=/Users/liyu.xiao/Library/pnpm:$PATH`. Per-file: `pnpm --filter ./app exec vitest run <path>`. Gate from repo root: `pnpm typecheck && pnpm lint && pnpm test`.
- Commit message ends with `Co-Authored-By: Claude Haiku 5.5 <noreply@anthropic.com>`. On 1Password "failed to fill whole buffer" retry the same commit; never `--no-gpg-sign`.

## Review Focus

- Name → breakdown → Start calls `commitGoal` once with the plan and then shows the committed state. No `listActiveWindows` call and no "Which window should I watch?" text is rendered.
- A failed `commitGoal` leaves the user on the breakdown step, logs the error, and does not show the committed state or close the flow.
- After the change, `grep -rn "listActiveWindows\|window:list-active\|StepConnect" app/src app/tests` returns nothing.

---

### Task 1: Remove the connect stage, move the commit, and delete the window IPC

**Files:**
- Modify: `app/src/renderer/overlay/SetupFlow/SetupFlow.tsx`
- Modify: `app/src/renderer/overlay/steps/Stepper/Stepper.tsx` (labels `Name`, `Breakdown`; `current` type `1 | 2`)
- Delete: `app/src/renderer/overlay/steps/StepConnect/` (whole directory)
- Delete: `app/tests/renderer/overlay/steps/StepConnect.test.tsx`
- Modify: `app/src/renderer/overlay/SetupFlow/SetupFlow.test.tsx` (step-machine literal tests: three steps, delete the "connect step only renders" test)
- Create: `app/src/renderer/overlay/SetupFlow/SetupFlow.flow.test.tsx` (behavioural test, jsdom)
- Modify: `app/src/main/ipc/system.ts` (remove `window:list-active` handler and the `openWindows` import)
- Modify: `app/src/preload/index.ts` (remove `listActiveWindows` from the type and the implementation)
- Modify: `app/src/renderer/global.d.ts` (remove `listActiveWindows`)

**Interfaces:**
- Consumes: `window.api.proposeGoal(goalText) => Promise<ProposedPlan>` and `window.api.commitGoal(plan) => Promise<{ goalId: string }>`.
- Produces: `SetupFlow` props unchanged (`variant?`, `onClose?`). Step type becomes `'name' | 'breakdown' | 'committed'`.

- [ ] **Step 1: Write the failing behavioural test**

Create `app/src/renderer/overlay/SetupFlow/SetupFlow.flow.test.tsx` with `// @vitest-environment jsdom` at the top. Model it on `app/src/renderer/main/pages/Onboarding/Onboarding.test.tsx` (it installs `window.api` with `Object.defineProperty`). Install `window.api` with:
- `proposeGoal` resolving to `{ goal: { title: 'Write essay' }, subtasks: [{ title: 'Outline', estimate_minutes: 30, depends_on: [] }] }`
- `commitGoal` resolving to `{ goalId: 'g1' }`
- `listActiveWindows` as `vi.fn()` (it must never be called)
- `closeOverlay` as `vi.fn().mockResolvedValue(undefined)`

Render `<SetupFlow variant="window" onClose={onClose} />`, enter a goal name, press the continue control on the name step, wait for the breakdown's Start control, press it. Use the same button labels and test ids the steps render: read `StepName.tsx` and `StepBreakdown.tsx` for the exact text and `data-testid`s. Assert:
- `commitGoal` was called once with the proposed plan
- `listActiveWindows` was not called
- the text "Which window should I watch?" is not in the document
- the Stepper no longer shows a "Connect" label

Add a second test: `commitGoal` rejects once; after pressing Start, the flow stays on the breakdown (Start is still available), `onClose` was not called, and `console.error` was called (spy and silence it).

If driving the flow needs more than this mocking (for example a required prop, or an async effect that cannot settle in jsdom), report the exact blocker and stop with BLOCKED rather than asserting less.

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter ./app exec vitest run src/renderer/overlay/SetupFlow/SetupFlow.flow.test.tsx`
Expected: FAIL. The first test fails because `listActiveWindows` is called on the connect step, or the window picker heading appears, or `commitGoal` is called from a later step.

- [ ] **Step 3: Remove the connect stage**

In `SetupFlow.tsx`:
- remove the `StepConnect` import
- change the `Step` type to `'name' | 'breakdown' | 'committed'`
- on `StepBreakdown`'s `onNext`, call `commitGoal(p)` first. On success: `setPlan(p)`, `setStep('committed')`, `setTimeout(close, 800)`. On failure: `console.error('Failed to commit goal:', err)` and stay on breakdown. Keep the `StepBreakdown` `plan`/`onBack` props as they are.
- remove the `connect` render block
- the Stepper call becomes `current={step === 'name' ? 1 : 2}` (committed shows 2)

In `Stepper.tsx`, remove `Connect` from the labels and make the type `1 | 2`.

Delete the `StepConnect` directory and `app/tests/renderer/overlay/steps/StepConnect.test.tsx`.

Update `SetupFlow.test.tsx`: the step list becomes three entries, and delete the "connect step only renders when plan is set" test.

- [ ] **Step 4: Remove the window IPC**

- `app/src/main/ipc/system.ts`: delete the `window:list-active` handler and the `openWindows` import (keep the screen-recording handlers and their import).
- `app/src/preload/index.ts`: delete `listActiveWindows` from the type (around line 128) and from the implementation (around line 201).
- `app/src/renderer/global.d.ts`: delete `listActiveWindows` (around line 101).

Do not touch `get-windows` in `package.json`.

- [ ] **Step 5: Run tests**

Run: `pnpm --filter ./app exec vitest run src/renderer/overlay tests/renderer/overlay`
Expected: PASS, including the new flow test. Then run `grep -rn "listActiveWindows\|window:list-active\|StepConnect" app/src app/tests` and report that it prints nothing.

- [ ] **Step 6: Full gate and commit**

From repo root with real exit codes: `pnpm typecheck`, `pnpm lint`, `pnpm test`. Then:

```bash
git add -A app/src app/tests
git commit -m "fix(setup): remove the watched-window picker from the task setup flow

Co-Authored-By: Claude Haiku 5.5 <noreply@anthropic.com>"
```

---

## Self-Review

- Spec coverage: queue item 8 covered by the flow test (no picker, one commit, failure path) and by removing the window IPC.
- Follow-ups (not this PR): onboarding and setup copy (item 12), the `Tracking started.` wording, the `window` variant chrome, the frozen window tracker's `get-windows` dependency (remains until the activity sources are deleted).
