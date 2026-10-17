# Remove Scheduling Settings (sweep item 13, phase 3)

**Goal:** The Settings page stops showing the "Horizon" and "Pause scheduling" controls. The working-hours setting stays, because the stall nudge reads it.

**Context:** Phase 1 (#439) stopped assigning times at plan creation. `horizonDays` is now read by nothing in app code except the Settings page; `planner/schedule.ts` takes horizon as an argument. `pauseScheduling` is still read by `app/src/main/activity/sources/system/window-tracker/window-tracker.ts` (frozen activity code), so the repo key stays. Only the UI goes.

**Spec:** `docs/superpowers/specs/2026-10-02-desktop-buddy-pivot-spec.md` §5 (no auto-scheduling). Scope source: `reports/pivot-removal-sweep-2026-10-10.md`, item 8.

## Global Constraints

- Keep the working-hours input and its persistence (`workingHours` in the settings repo and the Settings UI). The stall nudge reads it.
- Keep `pauseScheduling` in `app/src/main/store/repos/settings.ts` (`getAll`, `update`, row read). The frozen window tracker reads it.
- Keep `horizonDays` nowhere in renderer types or Settings code. Remove it from `app/src/main/store/repos/settings.ts` (the interface, `getAll`, and `update` branch). Do NOT edit the seed `INSERT` in `app/src/main/store/db.ts` (migration history).
- Do not touch `app/src/main/planner/schedule.ts` or its tests.
- Do not touch the plover-server repo in this PR.
- TypeScript strict; no comments unless WHY is non-obvious; no new deps.
- Commit trailer: `Co-Authored-By: Claude Haiku 5.5 <noreply@anthropic.com>`. On 1Password "failed to fill whole buffer", retry the same commit. Never use `--no-gpg-sign`.
- Gate from repo root: `export PATH=/Users/liyu.xiao/Library/pnpm:$PATH` then `NODE_OPTIONS=--no-experimental-webstorage pnpm typecheck && pnpm lint && NODE_OPTIONS=--no-experimental-webstorage pnpm test`. Per-file: `pnpm --filter ./app exec vitest run <path>`.

## File changes

1. `app/src/renderer/main/pages/Settings/sections/SchedulingSection/SchedulingSection.tsx` → rename the directory and file to `WorkingHoursSection/WorkingHoursSection.tsx` (use `git mv`), component `WorkingHoursSection`. Keep the "Working hours" block exactly as is. Delete the "Scheduling" block (Horizon input and Pause chip). Props: `workingHours`, `onWorkingHoursChange` only.
2. `app/src/renderer/main/pages/Settings/Settings.tsx`:
   - import and render `WorkingHoursSection` with only the two working-hours props.
   - remove `horizonDays` and `pauseScheduling` state, their fetch lines, the `handleHorizonChange` and `handlePauseSchedulingToggle` handlers, and their keys in the `triggerAutoSave` parameter type.
   - remove the stray `{' '}` after the section element.
3. `app/src/renderer/main/pages/Settings/Settings.test.tsx`: remove `horizonDays` and `pauseScheduling` from the mocked settings. Remove any assertion on "Horizon" or "Pause scheduling". Add one assertion that "Pause scheduling" and "Horizon" are not rendered.
4. `app/src/renderer/global.d.ts` and `app/src/preload/index.ts`: remove `horizonDays` and `pauseScheduling` from the settings types (each appears in several places; remove all of them).
5. `app/src/main/store/repos/settings.ts`: remove `horizonDays` from the interface, `getAll()` (the `map.get('horizonDays')` read and the returned field), and the `update` branch. Leave `pauseScheduling` alone.
6. `app/tests/renderer/App.test.tsx`, `app/tests/renderer/main/pages/Home.test.tsx`: remove `horizonDays` and `pauseScheduling` from mocked settings objects if present.
7. grep check: `grep -rn "horizonDays\|Horizon\|Pause scheduling" app/src app/tests` must show only the seed `INSERT` in `app/src/main/store/db.ts`, plus frozen `planner/schedule.ts` and its test.

## Tests

- Settings.test.tsx: render; assert "Working hours" heading present; assert no "Horizon" and no "Pause scheduling" text; changing the working-hours start input still calls `window.api.updateSettings` with `workingHours`.
- Repo test (if one covers settings in `app/tests/store/`): `getAll()` no longer has `horizonDays`; `pauseScheduling` still round-trips through `update`.

## Verification

- Run the gate above with real exit codes. Paste the final summary lines.
- Report the `grep` result from file change 7.

## Self-review

- Covered: UI removal, types, repo field, tests, seed left alone, frozen window-tracker still compiles because `pauseScheduling` remains.
- Not covered by design: plover-server `workingHours` requirement (separate repo, phase 2), and the app's `workingHours` request field in `decomposeGoal` (stays until phase 2 lands).
