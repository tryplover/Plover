# Plan: goal-level progress chip

## Context

The `+X%` pop currently shows the **raw per-task delta** — the increment
inference applied to one subtask's own 0–100 `progress`. That was unambiguous
when the bar beside it was a done-counter, because the two were obviously
different measures.

[#339](https://github.com/tryplover/Plover/pull/339) changed the bar to blended
goal progress. The pop and the bar are now adjacent, comparable, and disagree:
an 18-point move inside a subtask on a 6-step goal shows `+18` next to a bar
that advanced 3%.

The Figma frame `⑩ Progress-Detected — Medium + Minimized`
(`JSg9zi7iLYFO7e4CfjSPfj`, node `188:433`) shows 65% → 68% with a `+3` chip —
i.e. the chip and the bar agreeing. Confirmed with user: **the chip shows the
goal-level delta.** Inference keeps emitting per-task increments; conversion is
a display concern and happens in the renderer.

`goalDelta = taskDelta ÷ totalSteps`. The frame's own numbers are consistent
with that: 18 ÷ 6 = 3.

## Scope

This plan covers the **arithmetic only**. The animation from the Figma frame —
inline chip with a background, number counting up and warming mint, bar turning
mint transiently, and adding these tiers to `Collapsed.tsx` — is a separate
follow-up PR. Splitting keeps this one reviewable as pure logic with tests, and
leaves the visual PR to be judged on how it looks.

## Decisions taken

| Decision | Choice | Why |
|---|---|---|
| What the chip measures | Goal-level delta | A chip that disagrees with the bar beside it is worse than a smaller number |
| Sub-1% deltas | Accumulate and carry forward, fire on crossing 1% | A `+0` chip is worse than no chip; a threshold would make real progress invisible on long goals, which are exactly where the bar feels most static |
| Two deltas arriving close together | Coalesce into one chip, retarget | The displayed number should always converge on the current true value, never a stale one. Queueing lags; interrupting flashes |

Concurrency is not hypothetical: `summary.created` is emitted by both the
inference engine and `commit-task-matcher`, so a commit landing during an
inference pass produces two events seconds apart.

## Changes

### 1. `app/src/renderer/hooks/useProgressPops.ts`

Signature becomes `useProgressPops(taskId, enabled, totalSteps)` and returns a
single `ProgressPop | null` rather than an array — coalescing means there is
never more than one live chip.

Behaviour:

- On `summary.created` for `taskId`, add `progress_delta / totalSteps` to a
  carried fractional balance held in a ref.
- Emit only the whole-number part, and only when the balance has reached 1.
  Keep the remainder for next time.
- If a chip is already live, add to its delta and restart its timer instead of
  creating a second one.
- Reset carried balance when `taskId` changes — a remainder from a previous
  task must not leak into the next one's first chip.
- Guard `totalSteps < 1` (division by zero when a goal has no tasks yet).

### 2. `app/src/renderer/components/PercentPop/PercentPop.tsx`

`pops: ProgressPop[]` becomes `pop: ProgressPop | null`. The `AnimatePresence`
map collapses to a single conditional child. No visual change in this PR —
still the floating `+X%`; the chip treatment lands with the animation work.

### 3. Call sites pass `totalSteps`

- `Home.tsx` — the active task's goal is `defaultCurrentTask.goal_id`, so
  `tasksByGoal[defaultCurrentTask.goal_id]?.length ?? 0`.
- `Expanded.tsx` — `view.steps.length`, already the current goal's siblings.
- `GoalCard.tsx` — prop type changes from `ProgressPop[]` to
  `ProgressPop | null`; pass-through only.

### 4. Tests — `app/tests/renderer/hooks/useProgressPops.test.ts` (new)

The hook has no coverage today and this PR is entirely about its arithmetic, so
the tests are the substance of the review:

- converts a per-task delta to goal level (18 over 6 steps → `+3`)
- carries a sub-1% delta instead of emitting `+0`
- fires once carried deltas cross 1%
- coalesces two deltas arriving while a chip is live
- ignores events for a different task
- resets the carried balance when `taskId` changes
- no-ops when `enabled` is false or `totalSteps` is 0

## Explicitly out of scope

- The Figma animation (chip background, count-up, mint warming, bar tint)
- Adding pops to `Collapsed.tsx` (both `compact` and `full` variants) — neither
  has them today; the original dopamine-pops plan scoped `Collapsed` out
- Negative deltas. Progress cannot decrease yet; the design has no `-3`
  treatment and mint would be wrong for it. Deferred with the tracking-accuracy
  work
- Any change to what inference emits

## Verification

```
pnpm typecheck && pnpm lint && pnpm test
```
