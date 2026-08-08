# Plan: rewire the progress signal (judge → scoreboard)

## Context

Plover computes a continuous, AI-estimated per-task progress number
(`tasks.progress`, 0–100) but the prominent progress bar in the companion
overlay ignores it, displaying a discrete "subtasks done ÷ total subtasks"
fraction instead. The user wants the displayed number to reflect the AI
estimate so progress feels alive, with a screenshot-based verification step
gating actual subtask completion.

Investigation established three facts that shape this plan:

1. **There is no broken pipe.** `Task.progress` already reaches both renderer
   surfaces inside the object they render from. `Expanded.tsx` displays it in
   a small secondary line; `Collapsed.tsx` and the big `%` in both views
   display the locally-derived step fraction instead. Rebinding is a display
   change, not an integration.
2. **Inference excludes the task the user is working on.** `collectInputs`
   ([inference.ts:103](../../app/src/main/activity/inference/inference.ts))
   filters active tasks to `todo | scheduled`. `Home.tsx:73` sets a task to
   `in_progress` when the user starts it, and `pickCurrentTask`
   ([current-task.ts:21](../../app/src/shared/current-task.ts)) ranks
   `in_progress` **first** when choosing what the companion shows. Net effect:
   starting a task removes it from grading, and it is precisely the task on
   screen. Its number freezes until it is completed.
3. **`updatePacing` compounds it.** Pacing keys off `in_progress` tasks
   ([inference.ts:60](../../app/src/main/activity/inference/inference.ts)),
   dropping the interval 30min → 10min when one exists — tripling API spend to
   grade every task *except* that one.

Fact 2 is a bug and blocks everything else: rebinding the bar to a frozen
number produces a worse experience than today's chunky-but-moving bar.

## Design decisions taken

| Decision | Choice | Why |
|---|---|---|
| Which tasks the judge grades | All not-`done`/not-`skipped`, **not** only the current one | Sending one task asks a leading question ("is this progress on X?") with no competing answer. Multi-task attribution is load-bearing against inflation. |
| Bar scope | Blended: `(completed steps + current step fraction) ÷ total steps` | A straight swap to per-task progress silently changes the bar's meaning and makes it *drop to zero* when a step completes mid-goal. |
| Estimate ceiling | Judge caps at 90; only verification reaches 100 | A monotonic number that hits 100 and fails verification pins the bar at "done" indefinitely. Capping converts a lie into a designed "confirming" state. |
| Verification scope | Confirms the current step only; does **not** gate which step comes next | People work out of order. A sequencing gate deadlocks anyone who jumps ahead. |

### Still open — needed before Phase 4, not before Phases 1–3

- **Cost.** Fixing the filter means fast mode (10 min) finally applies to a
  task that gets graded, so it will actually fire. Accept, or retune cadence?
- **Can progress decrease?** Currently impossible. If verification finds a
  step incomplete, walking the number back is more honest but a retreating bar
  feels punishing.
- **Verification failure UX.** Sit silently at the cap, or actively prompt?
  The companion already has a `not-sure` state rendering "Still working on
  this?" with Yes/Pause ([Expanded.tsx:101](../../app/src/renderer/companion/Expanded.tsx))
  — the natural hook.

## Sequencing

Phases are independently shippable and ordered by dependency. Ship and verify
one at a time; do not batch.

---

### Phase 1 — Grade the task the user is on

**The bug fix. No UI change. Unblocks everything after it.**

- `collectInputs` ([inference.ts:103](../../app/src/main/activity/inference/inference.ts)):
  change the active-task filter from `t.status === 'todo' || t.status === 'scheduled'`
  to excluding `done` and `skipped`, so `in_progress` is included.
- Confirm `applyProgress`'s `validIds` set (built from `activeTasks`) widens
  with it — it does, same array.
- `updatePacing` needs no change; it already keys off `in_progress` and will
  now be speeding up for tasks that actually get graded.

**Tests:** [inference.test.ts](../../app/tests/activity/inference.test.ts) —
add a case asserting an `in_progress` task appears in the outbound
`/api/infer-progress` payload and receives its increment. Check existing cases
for ones that implicitly assert the old exclusion.

**Verify:** `pnpm typecheck && pnpm lint && pnpm test` green.

---

### Phase 2 — One definition of "current task"

Today `useCompanionState` picks the current task via `pickCurrentTask`, while
`Home.tsx` tracks its own `activeTaskId`. Nothing forces them to agree, and
Phase 3's bar depends on "the current step" meaning one thing.

- Audit both paths against `pickCurrentTask`
  ([current-task.ts](../../app/src/shared/current-task.ts)) and make it the
  single source of truth.
- Update the stale comment at `current-task.ts:15–20` — it claims
  "`in_progress` is rarely set by anything today," which `Home.tsx:73` has
  since made false.

**Note:** this is an audit-and-align phase, not a refactor. If both already
resolve identically in practice, record that and move on.

---

### Phase 3 — Rebind the bar to blended progress

The done-counter formula is currently duplicated in two places with no shared
helper:

- `stepsProgress()` ([useCompanionState.ts:69](../../app/src/renderer/companion/useCompanionState.ts))
- `goalCards` ([Home.tsx:195](../../app/src/renderer/main/pages/Home/Home.tsx))

Both compute `doneTasks.length / goalTasks.length`. Since the formula is
changing, extract one helper rather than editing the same maths twice and
letting them drift.

- New export in `app/src/shared/` (next to `current-task.ts`):
  `goalProgress(tasks, currentTaskId)` returning 0–1, computed as
  `(completedCount + currentTaskProgressFraction) / totalCount`, where the
  current task contributes `task.progress / 100`.
- **Unit note:** `Task.progress` is 0–100; the two consumers are 0–1
  fractions. Convert once, inside the helper. This exact 0–100 vs 0–1 trap is
  called out in [progress-dopamine-pops.md](progress-dopamine-pops.md).
- Guard: a task both counted as `done` *and* carrying `progress` must not be
  double-counted.
- Point `useCompanionState` and `Home.tsx` at the helper.

The bar now creeps continuously and still means "how far through the goal."
`ProgressLine` already animates ([Collapsed.tsx:31](../../app/src/renderer/companion/Collapsed.tsx)),
so no animation work is needed.

**Tests:** unit-test the helper directly (shared, pure, cheap) — empty task
list, all done, current task mid-progress, current task `done` with nonzero
progress.

---

### Phase 4 — Cap + verification gate

Largest phase, and the only one needing new main-process behaviour. Do not
start until the open questions above are answered.

- **Cap.** Clamp inference-driven increments so a task's estimated progress
  asymptotes at 90 rather than 100. `TasksRepo.incrementProgress`
  ([tasks.ts:279](../../app/src/main/store/repos/tasks.ts)) currently clamps
  to `MIN(100, ...)` and is called from both `inference.ts` and
  `commit-task-matcher.ts` — the cap belongs at the inference call site, not
  in the repo, so verified/manual completion can still reach 100.
- **Trigger.** When a task crosses the cap, request a verification pass rather
  than marking it done. Note `applyProgress` currently auto-completes on
  `entry.completed || updated.progress >= 100` — that auto-complete path is
  what this phase replaces.
- **Verifier.** Reuse the existing screenshot pipeline
  ([screen-capturer](../../app/src/main/activity/screen-capturer/screen-capturer.ts))
  on demand rather than adding a second capture path. Respect the existing
  permission gate ([shared/gate.ts](../../app/src/main/activity/shared/gate.ts));
  a task must degrade gracefully to "ask the user" when screen capture is
  unavailable or the task is not visually verifiable ("called the dentist").
- **Fallback.** Route inconclusive results to the companion's existing
  `not-sure` state instead of inventing a new UI affordance.

**Out of scope for this phase:** any change to how often inference runs, and
any confidence score in the response payload (see below).

---

## The contract question (raise before Phase 3 ships)

Every phase above still hands the UI a bare number. As tracking improves, the
UI will want to know more than "42%" — where the signal came from, how
confident it is, and **how stale it is**. Freshness is the most immediately
useful: nothing in the UI currently distinguishes a number updated 30 seconds
ago from one updated three hours ago, and even after Phase 1 the number
changes at most every 10 minutes.

Recommendation: before building UI on top of this, define one view-model the
renderer binds to — value, last delta, source, confidence, updated-at — so
later backend improvements fill fields rather than forcing component rework.
`InferProgressResponse` ([types.ts](../../app/src/main/activity/inference/types.ts))
carries no confidence field today; adding one is a backend change, not a
client one.

## Explicitly out of scope

- Validating whether the AI's estimates are *correct*. Nothing in the codebase
  checks them against ground truth. This plan improves *which* task gets
  graded and *how* the result is displayed, not grading quality. That belongs
  to [better-tracking.md](../superpowers/specs/phase-3/bets/better-tracking.md).
- Inference cadence changes.
- The three companion UI treatments the user has yet to describe — those
  layer on top of Phase 3 and should be planned separately once specified.
- Windows/macOS collector parity (browser URL capture is macOS-only today).

## Verification

```
pnpm typecheck && pnpm lint && pnpm test
```

Green after each phase, not just at the end. Manual GUI verification via
`pnpm dev` is unreliable in this environment — see the `plover-testing` skill.
