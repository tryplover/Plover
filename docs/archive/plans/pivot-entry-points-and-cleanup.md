# Pivot Entry Points and Leftover Cleanup (sweep items 15–16, non-frozen parts)

**Goal:** Two PRs. (A) Agent-facing and historical docs describe the current pivot, not the progress tracker. (B) Remove progress-era leftovers that have no readers. Frozen modules (activity, inference, connectors, scheduler, Today/Goals views) stay in place per CLAUDE.md ("leave in place, don't extend, don't delete yet").

**Source:** `reports/pivot-removal-sweep-2026-10-10.md` items 15 and 16. Website (item 14) is out of scope.

## Global Constraints

- One purpose per PR. Do not combine A and B.
- Do not delete any frozen module or file. Do not remove DB keys or migrations.
- Do not change product copy in the app UI.
- No new deps. No comments unless the WHY is non-obvious.
- Commit trailer: `Co-Authored-By: Claude Haiku 5.5 <noreply@anthropic.com>`. On 1Password "failed to fill whole buffer", retry the same commit. Never `--no-gpg-sign`.
- Gate (B only, and A if it touches any TS): from repo root, `export PATH=/Users/liyu.xiao/Library/pnpm:$PATH`, then `NODE_OPTIONS=--no-experimental-webstorage pnpm typecheck && NODE_OPTIONS=--no-experimental-webstorage pnpm lint && NODE_OPTIONS=--no-experimental-webstorage pnpm test`.

## PR A: docs/pivot-entry-points

Branch `docs/pivot-entry-points` from `origin/main`.

1. `AGENTS.md` (repo root). Current text is stale in these places:
   - Line ~9: says the app "shepherds the user to finish" goals and turns goals into a schedule. Rewrite to the buddy pivot: a desktop buddy with task breakdown, Pomodoro timer, site blocking, focus mode, read-only Calendar, and stall nudge. Point to the pivot spec.
   - Line ~14: calls `plover-server` an "Express proxy". It is a Python/FastAPI service in the standalone `plover-server` repo, deployed on Cloud Run. Fix the wording.
   - Lines ~17–20: "subtask scheduling into working-hours windows" and "monitoring and inference/progress signals have also landed" describe current behavior that is now frozen or removed. Rewrite as: frozen = activity monitoring, progress inference, connectors except Calendar, working-hours scheduler, Today/Goals views; removed from UI = progress percentages, goal bar, scheduling at plan creation.
   - Lines ~25–27 "Authoritative specs": the pivot spec is authoritative, the phase-1 docs still define module boundaries, the 2026-05-24 product spec is superseded. Reorder so the pivot spec is first and the 2026-05-24 spec is labeled superseded.
   - Line ~85: "see Lesson #4" points to a list that no longer exists. Replace with a pointer to the `plover-native-modules` and `plover-pnpm-workspace` skills (`.claude/skills/`).
   - Line ~120 port note: check that it matches the current `plover-server` default (read `plover-server` README or `python/plover/app.py` if needed; if unsure, say "see plover-server README").
   - Keep everything else (commands, layout, test conventions) unless it is wrong.
2. `docs/plans/progress-signal-rewire.md`: add one line directly under the title: `> **Status: paused and superseded by the desktop buddy pivot (2026-10-10 sweep). Do not implement.**` Change nothing else.
3. `README.md`: read it once. Only change a sentence that is factually wrong about current behavior. Expected: no change. Report what you checked.

Verification: `grep -n "Express\|Lesson #4\|shepherds\|scheduled" AGENTS.md` must show none of the stale wording. Open the markdown and check it still reads correctly.

## PR B: chore/remove-progress-leftovers

Branch `chore/remove-progress-leftovers` from `origin/main`.

1. `app/src/renderer/index.css`: delete the dead rule blocks `.goal-progress-container`, `.goal-progress-bar`, `.goal-progress-fill`, `.goal-progress-text` (around lines 522–550) and `.plover-progress-track`, `.plover-progress-fill` (around lines 925–940). Before deleting each block, grep `app/src` (tsx/ts) for the class name; the grep for `plover-progress-` and `goal-progress-` in tsx/ts must return nothing. Delete only the rule blocks for those selectors, not neighbors. Keep the Onboarding CSS: `CarouselMockup.tsx` uses its classes and it is live.
2. Rename `sortByScheduledStart` to `sortByPlanOrder` in `app/src/shared/current-task.ts` (definition, the comment that names it, and the call in `pickCurrentTask`) and in `app/src/renderer/main/pages/Home/Home.tsx` (import and call at line ~173). The function sorts by `sort_index`, so the old name is misleading. Grep the whole repo (`app/src app/tests`) afterward to confirm no old name remains.
3. Remove `progressPopsEnabled` readers and types that have no consumer:
   - `app/src/renderer/global.d.ts` lines ~33, ~51, ~68: remove the `progressPopsEnabled: boolean;` field in each settings shape.
   - `app/src/main/store/repos/settings.ts` lines ~28 and ~140: remove the field from the interface and the `getAll()` read. Leave the DB row and any `update` branch alone only if removing it would break a test; otherwise remove the `update` branch too. Do not touch `db.ts` or migrations.
   - Check `app/src/preload/index.ts` for the same field and remove it if present.
4. Tests: run the gate. If any test references the removed field or the old function name, update it to the new name or drop the assertion that depended on the removed field.

Verification: `grep -rn "sortByScheduledStart\|progressPopsEnabled\|goal-progress-\|plover-progress-" app/src app/tests` must return nothing. Gate green with real exit codes.

## Self-review

- Covered: sweep item 15 (docs, plans marked historical); item 16 non-frozen dead leftovers.
- Not covered: physical deletion of frozen modules (CLAUDE.md freeze); website (item 14); onboarding CSS (live); DB keys and migrations.
