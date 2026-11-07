# Stop Sending workingHours to Decompose (sweep item 13, phase 2b)

**Goal:** The app's `/api/decompose` request body carries only `goalText` and `now`. plover-server no longer requires `workingHours` (merged in plover-server #23, deployed).

**Spec:** sweep item 13 in `reports/pivot-removal-sweep-2026-10-10.md`. Previous phases: #439, #440.

## Global Constraints

- Keep `workingHours` in settings (the stall nudge reads it: `app/src/main/nudge/engine.ts`). Do not touch `settings.ts`, `nudge/engine.ts`, or the Settings UI.
- Keep `app/src/main/planner/schedule.ts` and its tests unchanged.
- TypeScript strict; no comments; no new deps.
- Commit trailer: `Co-Authored-By: Claude Haiku 5.5 <noreply@anthropic.com>`. On 1Password "failed to fill whole buffer", retry the same commit. Never `--no-gpg-sign`.
- Gate from repo root: `export PATH=/Users/liyu.xiao/Library/pnpm:$PATH`, then `NODE_OPTIONS=--no-experimental-webstorage pnpm typecheck && NODE_OPTIONS=--no-experimental-webstorage pnpm lint && NODE_OPTIONS=--no-experimental-webstorage pnpm test`.

## File changes

1. `app/src/main/planner/decompose.ts`: remove `workingHours` from the input type (line ~10) and from the request body built from `input` (line ~29). The body is `goalText` and `now` only.
2. `app/src/main/ipc/goals.ts`: remove `workingHours: settings.workingHours` from the `decomposeGoal` call (line ~23). If `settings` is then unused in that call site, remove the unused variable or read; do not leave dead code.
3. `app/tests/planner/planner-decompose.test.ts`:
   - remove `workingHours` from every `decomposeGoal` input in the file (lines ~61, 100, 118, 139, 162, 177, 189, 206).
   - line ~42: the fetch-body assertion that reads `body.workingHours.start` must go. Replace it with an assertion that `body.workingHours` is undefined, or drop that condition if it is part of a larger expression. Read the surrounding code first.
   - line ~210: change the expected keys to `['goalText', 'now']`.

## Verification

- Gate above, real exit codes.
- `grep -rn "workingHours" app/src/main/planner app/src/main/ipc app/tests/planner` must show nothing.

## Self-review

- Covered: request body, input type, caller, tests.
- Not covered by design: settings key and nudge (still use working hours).
