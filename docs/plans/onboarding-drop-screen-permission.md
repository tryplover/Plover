# Drop the Screen-Permission Onboarding Step Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish onboarding without ever requesting macOS screen-recording permission or opening System Settings.

**Architecture:** `Onboarding.tsx` is a numbered step machine (0 welcome, 1 use-case, 2 promise, 3 grant access, 4 setup-complete interstitial, 5 task carousel, 9 trial close; `handleNext` jumps 5 to 9, `handleBack` jumps 9 to 5). Remove step 3 and its handler, shift later steps down by one, delete `StepGrantAccess`.

**Tech Stack:** React, TypeScript (strict), vitest + Testing Library. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-10-02-desktop-buddy-pivot-spec.md` (§5: no screen capture; the app requests no Screen Recording permission). Scope source: `reports/pivot-removal-sweep-2026-10-10.md`, queue item 7: "Remove the onboarding screen-permission requirement" with regression "finish onboarding without screen permission/request/settings launch".

**Stacking:** branch `chore/onboarding-no-screen-permission`, stacked on `chore/drop-activity-from-decompose` (PR #418). PR base is that branch.

## Global Constraints

- One purpose: remove the permission step from the onboarding flow only.
- Preserve: preload `requestScreenRecording` / `openScreenRecordingSettings`, the IPC handlers in `main/ipc/system.ts`, `main/permissions/screen-recording.ts` and its test, and the Settings page uses (a later queue item removes those).
- Not in this PR: other onboarding copy (StepPromise, carousel, welcome; queue item 12), the setup-flow window picker (item 8). Existing copy in those steps stays as is.
- Keep phase stepper behaviour: `phaseForStep` thresholds stay valid after the shift (verify; adjust only if the stepper would otherwise skip or mislabel a phase).
- TypeScript strict; no comments unless WHY is non-obvious; no new deps. No dead code left behind: unused imports, handler, and component directory go.
- pnpm: `export PATH=/Users/liyu.xiao/Library/pnpm:$PATH`. Per-file: `pnpm --filter ./app exec vitest run <path>`. Gate from repo root: `pnpm typecheck && pnpm lint && pnpm test`. Note: `plover-testing` skill says `Onboarding.test.tsx` may fail on `main` as pre-existing (waitFor timeout); if it fails before your change on this branch, report that rather than guessing.
- Commit message ends with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. On 1Password "failed to fill whole buffer" retry the same commit; never `--no-gpg-sign`.

## Review Focus

- Walking the wizard from welcome to trial close never renders `step-permission` and never calls `requestScreenRecording` or `openScreenRecordingSettings` (asserted with the mocks already in the test).
- Back navigation from the interstitial returns to the promise step; from trial close returns to the carousel.
- The stepper still shows a sensible phase at every remaining step.

---

### Task 1: Remove the permission step

**Files:**
- Modify: `app/src/renderer/main/pages/Onboarding/Onboarding.tsx`
- Delete: `app/src/renderer/main/pages/Onboarding/steps/StepGrantAccess/` (whole directory)
- Modify: `app/src/renderer/main/pages/Onboarding/Onboarding.test.tsx`

- [ ] **Step 1: Update the test first**

In `Onboarding.test.tsx`, in the wizard walk-through test: delete the "Step 3: Permission Screen" block (the `step-permission` expectation, the title text expectation, and the `btn-grant-settings` click), so clicking promise continue leads straight to `step-interstitial`. Renumber the comments. After the walk-through finishes (before or after the trial-close assertions), add `expect(mockRequestScreenRecording).not.toHaveBeenCalled(); expect(mockOpenScreenRecordingSettings).not.toHaveBeenCalled(); expect(screen.queryByTestId('step-permission')).toBeNull();`. Add a back-navigation test: from the interstitial, clicking Back lands on `step-promise`. Rename "10-step wizard" in the test title to match the remaining count.

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter ./app exec vitest run src/renderer/main/pages/Onboarding/Onboarding.test.tsx`
Expected: the walk-through and new back test FAIL (permission step still rendered). If this file already fails before your edit for an unrelated reason, report it exactly and stop with BLOCKED.

- [ ] **Step 3: Remove the step**

In `Onboarding.tsx`: delete the `StepGrantAccess` import, the `handleOpenSettingsAndRequest` handler, and the step-3 render block; renumber the remaining renders (setup-complete 3, carousel 4); change `handleNext`'s `prev === 5` to `prev === 4` and `handleBack`'s `prev === 9` target from 5 to 4 and; keep trial close at 9. Check `phaseForStep` still maps sensibly. Delete the `StepGrantAccess` directory. Check for other references with grep (`StepGrantAccess`, `step-permission`) and fix.

- [ ] **Step 4: Run tests**

Run: `pnpm --filter ./app exec vitest run src/renderer/main/pages`
Expected: PASS.

- [ ] **Step 5: Full gate and commit**

From repo root, real exit codes: `pnpm typecheck`, `pnpm lint`, `pnpm test`. Then:

```bash
git add -A app/src/renderer/main/pages/Onboarding
git commit -m "fix(onboarding): remove the screen-recording permission step

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

## Self-Review

- Spec coverage: queue item 7 covered by the walk-through asserting no permission call and no permission step.
- Follow-ups (not this PR): onboarding copy (item 12), Settings permission UI (item 11), setup window picker (item 8).
