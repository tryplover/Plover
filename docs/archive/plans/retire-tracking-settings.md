# Retire Tracking Settings in the UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove every user-facing control that turns on or configures activity tracking, screen capture, Docs progress tracking, or progress pops from the Settings page. The runtime, store keys, and IPC stay as they are (frozen).

**Architecture:** Settings is `app/src/renderer/main/pages/Settings/Settings.tsx`, which mounts `ActivityTrackingSection` (the whole tracking card) and passes `progressPopsEnabled` into `AppearanceSection`. Remove the card and its handlers and state, the pops row, and the Docs-tracking sentence in `AccountSection`. Google connect/disconnect stays (Calendar, M6).

**Tech Stack:** React, TypeScript (strict), vitest + Testing Library (jsdom). No new dependencies.

**Spec:** `docs/superpowers/specs/2026-10-02-desktop-buddy-pivot-spec.md` §4.6 (Settings is minimal: timer lengths, nudge interval, blocklist, calendar connect/disconnect, hotkey, stall nudge toggle) and §6 (activity and Docs sync frozen). Scope source: `reports/pivot-removal-sweep-2026-10-10.md` item 11 and "Tracking settings and context-connect controls" row (keep app sign-in and sign-out).

**Stacking:** branch `chore/retire-tracking-settings` is stacked on `feat/stall-nudge-settings` (PR #436), because Settings.tsx has the stall nudge card. PR base is that branch.

## Global Constraints

- One purpose: remove the tracking and pops controls from Settings. No runtime change.
- Preserve: all store keys and `settings.ts` defaults (`pauseAllTracking`, `windowTrackingEnabled`, `gdocsPollingEnabled`, `fileWatchingEnabled`, `screenCaptureEnabled`, `screenVisionInferenceEnabled`, `screenCaptureIntervalMinutes`, `activityRetentionDays`, `planner_useRecentActivityContext`, `progressPopsEnabled`); the preload and `global.d.ts` types for those keys; the `screen-recording` IPC and preload functions; the activity module; the Sign in with Google / Sign out control and the Google Calendar Connect / Disconnect button; the scheduling section; the stall nudge card.
- Not in this PR: deleting any store key, IPC, or preload binding (sweep item 16, later).
- TypeScript strict; no comments unless WHY is non-obvious; no new deps. No dead code: unused imports, state, handlers, props, and the `ActivityTrackingSection` directory go.
- pnpm: `export PATH=/Users/liyu.xiao/Library/pnpm:$PATH`. Per-file: `pnpm --filter ./app exec vitest run <path>`. Gate from repo root: `pnpm typecheck && pnpm lint && pnpm test`.
- Commit message ends with `Co-Authored-By: Claude Haiku 5.5 <noreply@anthropic.com>`. On 1Password "failed to fill whole buffer" retry the same commit; never `--no-gpg-sign`.

## Review Focus

- The Settings page shows no activity tracking, screen capture, retention, recent-activity, Docs-tracking, or progress-pops control. Check with: `grep -rn "Activity tracking\|screen capture\|Screen capture\|Docs progress\|progress pops\|Progress pops\|pauseAllTracking\|activityRetentionDays" app/src/renderer/main/pages/Settings` returns nothing.
- Google connect and disconnect, Sign in with Google, and the stall nudge toggle still render.
- Saving another setting (for example the stall nudge toggle) no longer calls the activity save path.

---

### Task 1: Remove tracking and pops controls from Settings

**Files:**
- Modify: `app/src/renderer/main/pages/Settings/Settings.tsx`
- Delete: `app/src/renderer/main/pages/Settings/sections/ActivityTrackingSection/` (whole directory)
- Modify: `app/src/renderer/main/pages/Settings/sections/AppearanceSection/AppearanceSection.tsx` (remove the `progressPopsEnabled` and `onProgressPopsToggle` props and the pops row)
- Modify: `app/src/renderer/main/pages/Settings/sections/AccountSection/AccountSection.tsx` (remove the "Connect Google to enable Docs progress tracking" sentence and any block that only exists for it; keep the Google connect and disconnect button)
- Modify: the Settings test file (`app/src/renderer/main/pages/Settings/Settings.test.tsx`) for removed controls

In `Settings.tsx` remove: the `ActivityTrackingSection` import and mount, the `activitySettings`, `screenPermission`, and `activityMessage` state, `triggerActivitySave`, `handleScreenCaptureToggle`, `handleWindowTrackingToggle`, the load code that reads the activity and gdocs fields, `progressPopsEnabled` state, its load line, `handleProgressPopsToggle`, the `progressPopsEnabled` patch type, and the props passed to `AppearanceSection`. Remove any import that becomes unused (for example `defaultActivitySettings`, `ActivitySettings`, and the screen-recording calls). Keep the stall nudge state, load, and card.

**Interfaces:**
- Produces: `AppearanceSection` props no longer include `progressPopsEnabled` or `onProgressPopsToggle`.

- [ ] **Step 1: Write failing tests**

In the Settings test file, add: (a) with `getSettings` resolving `windowTrackingEnabled: true` and `screenCaptureEnabled: true`, render Settings and assert no text matching `/Activity tracking|Screen capture|Progress pops/i` is in the document; (b) assert the text "Stall nudges" is still present, and the text "Sign in with Google" or "Sign out" is still present (whichever the test's mocked auth state renders). Remove any existing test that clicks a removed control.

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter ./app exec vitest run src/renderer/main/pages/Settings`
Expected: assertion (a) FAILS because the tracking card still renders. Report the exact failure.

- [ ] **Step 3: Remove the controls** as listed above.

- [ ] **Step 4: Run tests**

Run: `pnpm --filter ./app exec vitest run src/renderer/main/pages/Settings src/renderer/main`
Expected: PASS. Then run the grep in Review Focus and report its output (expected: no matches).

- [ ] **Step 5: Full gate and commit**

From repo root with real exit codes: `pnpm typecheck`, `pnpm lint`, `pnpm test`. Then:

```bash
git add -A app/src
git commit -m "fix(settings): remove tracking and progress pop controls from Settings

Co-Authored-By: Claude Haiku 5.5 <noreply@anthropic.com>"
```

---

## Self-Review

- Spec coverage: sweep item 11 (user-facing tracking enablement and settings removed after the runtime freeze) is covered by the controls removal and the grep check. Sign-in and Calendar connect are explicitly preserved.
- Follow-ups (not this PR): deleting store keys, preload types, and IPC (item 16); the scheduling section (item 13); the `progressPopsEnabled` store key.
