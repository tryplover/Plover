# Plan: remove per-subtask watching, fix goal-row watch button visibility, decouple "viewing a goal's steps" from "WATCHING NOW"

## Context

Branch: `feat/sync-companion-active-task-v2`. Three prior commits on this branch built:
(1) companion pill syncing with the real active task, (2) broadened event-driven refresh,
(3) a per-subtask "Watch this" button, (4) a per-goal-row "Watch this" button. User tried
it and gave three pieces of feedback, all addressed here:

### 1. Remove the per-subtask "Watch this" button

User's reasoning: subtasks are already planned in order via the setup modal (`SetupFlow`) —
Plover should just follow that plan sequentially, not let the user manually re-pick which
specific subtask is "current." If jumping around steps turns out to be a real recurring
need, that's a future "edit the plan" feature, not a per-step watch button. Remove
`StepRow`'s `onSelect` prop entirely (added in `docs/plans/select-active-task-button.md`,
its only caller) — it's now dead: `grep -rln onSelect app/src/renderer app/tests` shows
only `StepRow.tsx` (definition), `Home.tsx` (caller), `StepRow.test.tsx` (tests). Remove all
three usages, don't leave orphaned prop/CSS/tests per the "no backwards-compat shims for
code that hasn't shipped" convention in `CLAUDE.md`.

### 2. Goal-row "Watch this" button is nearly invisible

Screenshot showed both non-active rows with a barely-visible faint circle icon — same low
opacity as the (intentionally subtle) delete button. `.plover-shell--light
.plover-home-task-row__watch` currently inherits `.plover-home-task-row__delete`'s
`rgba(36, 33, 28, 0.45)` resting color with no background, so at rest it's easy to miss
entirely — "if it's not being focused in the moment, you can't really see it, and no one's
going to use that." Give it a permanently-visible mint-tinted circular background (not just
on `:hover`) so it reads as an available action regardless of hover/focus state, visually
distinct from the deliberately-subtle delete button.

### 3. Clicking a row to view it shouldn't say "WATCHING NOW"

This is the real bug. Currently: `activeGoalId = selectedGoalId ?? defaultActiveGoalId`.
Clicking *any* non-active row sets `selectedGoalId = goal.id`, which immediately makes
`activeGoalId` (and therefore `isActive`/"WATCHING NOW"/the green border) point at that row
— even though nothing about which task is actually `in_progress` changed. The companion
pill (which computes its own active task independently from real task data, unaffected by
Home's local `selectedGoalId`) correctly *doesn't* follow along — which is exactly the
mismatch the user described noticing ("it's not switching... but it still says 'watching
now,' even though the task stays the same" in the companion). Viewing a goal's plan and
watching a goal must become two independent concerns:

- **Viewing**: which goal's steps panel is expanded, for inspection. Should work for *any*
  row, active or not, and must never affect the "WATCHING NOW" badge.
- **Watching**: which goal/task is really `in_progress` — driven purely by real task data
  (`pickCurrentTask(tasks)`), changed only by the explicit "Watch this" button (point 2).

## Files to change

### `app/src/renderer/main/pages/Home.tsx`

Rename `selectedGoalId` → `expandedGoalId` (same `useState<string | null>(null)`) to make
its new, narrower role explicit at every call site — it's not "override the active goal"
anymore, it's purely "which panel is open."

Remove the `selectedGoalId ??` fallback entirely:

```ts
const activeGoalId = defaultActiveGoalId;
```

Change the row click handler to toggle/switch `expandedGoalId` uniformly for every row
(not just non-active ones — dropping the `if (isActive) ... else ...` branch since both
branches did the same "toggle if already this one, else switch to it" logic, just keyed off
the wrong piece of state before):

```ts
onClick={() => {
  if (expandedGoalId === goal.id) {
    setStepsExpanded((v) => !v);
  } else {
    setExpandedGoalId(goal.id);
    setStepsExpanded(true);
  }
}}
```

Change the steps-panel render condition from `{isActive && stepsExpanded && (...)}` to
`{expandedGoalId === goal.id && stepsExpanded && (...)}` so any goal's panel can be opened
for viewing, not just the active one.

Change `activeGoalSteps` to read from `expandedGoalId` instead of `activeGoalId`:

```ts
const activeGoalSteps = useMemo(() => {
  if (!expandedGoalId) return [];
  return sortByScheduledStart(tasksByGoal[expandedGoalId] ?? []);
}, [expandedGoalId, tasksByGoal]);
```

Change `currentTask`/`activeTaskId` (used only for step-row highlighting inside whichever
panel is open) to distinguish "viewing the truly-active goal" (show the real current task)
from "previewing some other goal" (show nothing as current — no ring, no "now" — since
nothing in a non-watched goal is actually being tracked right now; avoid implying otherwise):

```ts
const currentTask = useMemo(() => {
  if (expandedGoalId && expandedGoalId === activeGoalId) return defaultCurrentTask;
  return null;
}, [expandedGoalId, activeGoalId, defaultCurrentTask]);
const activeTaskId = currentTask?.id ?? null;
```

(This also means the `StepRow` `state` prop for a previewed non-active goal's steps is
never `'current'` — every non-done step renders as plain `'pending'`, which is correct: none
of them are actually the live current task.)

Remove the `onSelect` prop from the `StepRow` usage in the steps panel (was
`onSelect={() => void selectAsActiveTask(step.id)}`) — delete that line entirely. Leave
`onDelete` as-is.

Update `watchGoal` to set `expandedGoalId` instead of clearing it (previously it did
`setSelectedGoalId(null)` to route around the staleness bug — that workaround is no longer
needed since `activeGoalId` no longer depends on this state at all, but we still want the
panel to open showing what was just watched):

```ts
const watchGoal = useCallback(
  async (goal: Goal) => {
    const goalTasks = tasksByGoal[goal.id] ?? [];
    const target = pickCurrentTask(goalTasks) ?? goalTasks[0];
    if (!target) return;
    setExpandedGoalId(goal.id);
    setStepsExpanded(true);
    await selectAsActiveTask(target.id);
  },
  [tasksByGoal, selectAsActiveTask],
);
```

Update the goal-row delete handler's `if (selectedGoalId === goal.id) setSelectedGoalId(null);`
guard (~line 255-257) to use the renamed `expandedGoalId`/`setExpandedGoalId`.

`selectAsActiveTask` itself is unchanged — still used by `watchGoal`, just no longer called
directly from a per-step button.

### `app/src/renderer/components/StepRow.tsx`

Remove the `onSelect` prop from `StepRowProps`, the destructured parameter, and its
`<button className="plover-step__select">` block (including the now-unused SVG markup) from
the trailing-container render. Update the trailing-container's visibility condition
(`{(trailing || onDelete || onSelect || dragHandleProps) && (...)}`) to drop `onSelect`.

### `app/src/renderer/components/StepRow.css`

Remove the `.plover-step__select` rule (and its `.plover-shell--light` override) — it was
introduced alongside `onSelect` and has no other purpose.

### `app/src/renderer/main/pages/Home.css`

Give `.plover-home-task-row__watch` a permanently-visible resting state, separate from
`.plover-home-task-row__delete`'s shared box rules (split them into their own selector
instead of the merged one from the prior commit, since they now diverge):

```css
.plover-home-task-row__watch {
  background: rgba(183, 228, 199, 0.16);
  color: var(--plover-mint);
  border: none;
  cursor: pointer;
  padding: 8px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color var(--plover-duration-fast);
}

.plover-home-task-row__watch:hover {
  background: rgba(183, 228, 199, 0.3);
}
```

Add a `.plover-shell--light .plover-home-task-row__watch` override if the light theme's
mint token/values differ from dark — check how `.plover-shell--light .plover-step__select`
(added in the prior plan) handles this and mirror it; reuse the same light-mode mint
rgba values already established there rather than inventing new ones.

### Tests

- `app/tests/renderer/components/StepRow.test.tsx`: remove the two `onSelect` test cases
  added in the prior plan (button renders when `state !== 'current'` and fires callback).
- Grep `app/tests` for any other reference to `onSelect`/`.plover-step__select` and remove.
- No `Home.tsx` test file exists (confirmed in prior plans on this branch) — nothing to
  update there.

## Out of scope

- Don't build a plan-editing feature (the user mentioned it as a possible *future*
  direction if step-jumping turns out to be needed — not requested now).
- Don't change `selectAsActiveTask` or the underlying `in_progress`-status mechanism —
  still correct, just now triggered only from the goal-row button.
- Don't add multi-panel-expanded support (expanding more than one goal's steps at once) —
  `expandedGoalId` is still a single value; clicking a different row's body still switches
  which one panel is shown, same one-at-a-time behavior as before, just decoupled from
  "active."

## Verification

From repo root: `pnpm typecheck && pnpm lint && pnpm test`. Same pattern as prior plans on
this branch: commit locally, then pull into `D:\GitHub\Plover` (`git pull --ff-only
<path-to-C:-checkout> feat/sync-companion-active-task-v2`) since that's where the user
verifies visually. Flag this explicitly when reporting back.
