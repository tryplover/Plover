# Remove False Onboarding Claims Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove onboarding copy that claims behaviour the app no longer has: watching windows, reading progress from pictures, storing nothing (false), auto-filling a progress bar, and "The Progress Bar That Works". Keep the step structure, the controls, and the art.

**Architecture:** Onboarding copy lives in four files under `app/src/renderer/main/pages/Onboarding/steps/`. Change only the strings and the claim-bearing sentences. Update the matching assertions in `Onboarding.test.tsx`.

**Tech Stack:** React, TypeScript (strict), vitest + Testing Library (jsdom). No new dependencies.

**Spec:** `docs/superpowers/specs/2026-10-02-desktop-buddy-pivot-spec.md` §4.1 (steps are checked off by hand; no AI progress estimate), §5 (no window-title logging or screen capture). Scope source: `reports/pivot-removal-sweep-2026-10-10.md` item 12. User decision (2026-10-15): remove the false claims.

**Stacking:** branch `chore/onboarding-copy-cleanup`, based on `main`. It does not touch StepGrantAccess, so it has no conflict with #419.

## Global Constraints

- Copy only. No change to step order, controls, test IDs, routing, or the animation and art files (`*.css`, mockup layout).
- Do not add new promises. Replacement copy must describe only what the app does now: the user names goals and steps, and ticks steps off by hand.
- Keep the step heading "Before we go further ..." and its continue control, which the test relies on.
- TypeScript strict; no comments; no new deps.
- pnpm: `export PATH=/Users/liyu.xiao/Library/pnpm:$PATH`. Per-file: `pnpm --filter ./app exec vitest run <path>`. Gate from repo root: `pnpm typecheck && pnpm lint && pnpm test`.
- Commit message ends with `Co-Authored-By: Claude Haiku 5.5 <noreply@anthropic.com>`. On 1Password "failed to fill whole buffer" retry the same commit; never `--no-gpg-sign`.

## Exact Changes

| File | Current text | New text |
|---|---|---|
| `steps/StepWelcome/StepWelcome.tsx` (line ~25) | `The Progress Bar That Works` | `A calm place for your work.` |
| `steps/StepTaskCarousel/StepTaskCarousel.tsx` (slideLabels, last entry) | `✓ You're all set — Plover automatically fills the progress bar as you work.` | `✓ You're all set. Tick off steps as you go.` |
| `steps/StepTaskCarousel/StepTaskCarousel.tsx` (slideLabels, third entry) | `• Connect the documents and applications you want Plover to watch.` | `• Add the first step, then start on it.` |
| `steps/StepTaskCarousel/CarouselMockup.tsx` (line ~120) | `Which window should I watch?` | `What's the next step?` |
| `steps/StepTaskCarousel/CarouselMockup.tsx` (line ~218) | `That's it. Plover's watching.` | `That's it. Tick off steps as you go.` |
| `steps/StepPromise/StepPromise.tsx` (line ~38) | `It reads the progress, then forgets the picture. Nothing is stored, ever.` | remove the whole promise card, and every other promise card on that page that claims window selection, watching, screenshots, or stored pictures |

Read `StepPromise.tsx` in full first. If every promise card is a false claim, render the step with only its heading and continue control, and keep the step's `data-testid`. Do not invent replacement promises. Report the final text of the page.

In `CarouselMockup.tsx`, if the mock shows a fill bar or a progress percentage as the "work" demo, remove only that element so the mock does not imply automatic progress. Keep the rest of the mock.

## Review Focus

- No onboarding string mentions watching, windows, screenshots, pictures, "automatic", "fills", or "Progress Bar". Check with: `grep -rni "watch\|window\|screenshot\|picture\|automatic\|fills\|progress bar" app/src/renderer/main/pages/Onboarding --include='*.tsx' | grep -v test`. Any remaining match must be a non-claim (report it).
- The test IDs and step order are unchanged.

---

### Task 1: Replace the false onboarding claims

**Files:**
- Modify: `app/src/renderer/main/pages/Onboarding/steps/StepWelcome/StepWelcome.tsx`
- Modify: `app/src/renderer/main/pages/Onboarding/steps/StepTaskCarousel/StepTaskCarousel.tsx`
- Modify: `app/src/renderer/main/pages/Onboarding/steps/StepTaskCarousel/CarouselMockup.tsx`
- Modify: `app/src/renderer/main/pages/Onboarding/steps/StepPromise/StepPromise.tsx`
- Modify: `app/src/renderer/main/pages/Onboarding/Onboarding.test.tsx` (update the three string assertions: the welcome title, "Which window should I watch?", "That's it. Plover's watching.")

- [ ] **Step 1: Update the test assertions first**

In `Onboarding.test.tsx`, change `'The Progress Bar That Works'` to `'A calm place for your work.'`, `'Which window should I watch?'` to `"What's the next step?"`, and `"That's it. Plover's watching."` to `"That's it. Tick off steps as you go."`. Add one assertion to the walk-through test: `expect(document.body.textContent).not.toMatch(/Progress Bar That Works|Plover's watching|Which window should I watch/)`.

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter ./app exec vitest run src/renderer/main/pages/Onboarding`
Expected: FAIL on the updated assertions (old strings still rendered). Report the exact failure. If the file already fails for an unrelated reason (localStorage or waitFor), report that and say whether it is pre-existing.

- [ ] **Step 3: Apply the changes** in the table above, read `StepPromise.tsx` in full first.

- [ ] **Step 4: Run tests**

Run: `pnpm --filter ./app exec vitest run src/renderer/main/pages/Onboarding`
Expected: PASS. Then run the grep in Review Focus and report its output.

- [ ] **Step 5: Full gate and commit**

From repo root with real exit codes: `pnpm typecheck`, `pnpm lint`, `pnpm test`. Then:

```bash
git add -A app/src/renderer/main/pages/Onboarding
git commit -m "fix(onboarding): remove claims the app no longer makes

Co-Authored-By: Claude Haiku 5.5 <noreply@anthropic.com>"
```

---

## Self-Review

- Spec coverage: sweep item 12 (onboarding promises) covered for the onboarding flow. The Home empty-state copy was already changed in #432 and is flagged there. Website and `en.json` copy are separate items (14) and do not exist in this repo's locales.
- Follow-ups (not this PR): Home empty-state copy sign-off (#432), website copy (item 14), the overlay `StepConnect` heading (removed with #430).
