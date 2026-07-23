# Plan: "Watch this" button on each top-level Home row, not just buried in subtasks

## Context

Branch: `feat/sync-companion-active-task-v2` (already has the companion sync fixes and the
per-subtask "Watch this" button from `docs/plans/select-active-task-button.md`).

Follow-up from the user after trying the subtask-level button: they want the same
affordance directly on each **top-level row** in Home's list (the ones showing a title,
progress bar, and `%` — these are `Goal`s in the data model, but the user's mental model
calls them "tasks," and that's what they mean by "beside each task"). Currently only the
*active* row shows anything related to watching (`WATCHING NOW`, a static badge); inactive
rows have no way to become the watched one except drilling in — click the row to expand its
steps, then find and click the right subtask's small button. The user wants: click a button
right on the row itself and it becomes the watched one immediately, same as the subtask
button already does, with `WATCHING NOW` moving to it.

Confirmed not broken and not in scope to touch: the progress % shown per row
(`doneTasks.length / goalTasks.length` in `goalCards`) already doesn't reset or change
based on which task is marked `in_progress` — switching what's watched doesn't affect
progress, it already "continues at whatever % it's at," which is what the user described
wanting. No change needed there, just confirm this to the user when reporting back.

**One real bug this surfaces:** `activeGoalId = selectedGoalId ?? defaultActiveGoalId`.
`selectedGoalId` is a manual pin set when the user clicks into a *different, non-active*
goal to view its steps. If a goal-row watch button is clicked while `selectedGoalId` is
pinned to some *other* goal, `activeGoalId` (and therefore the `WATCHING NOW` badge) would
keep showing the stale pinned goal instead of the one just watched, even though the
underlying task data is now correct. Must clear `selectedGoalId` as part of the new handler
so `activeGoalId` falls back to `defaultActiveGoalId`, which will correctly resolve to the
just-watched goal once `pickCurrentTask(tasks)` sees its task as `in_progress`.

## Files to change

### `app/src/renderer/main/pages/Home.tsx`

Add a `watchGoal` callback, above the JSX return, that reuses the already-existing
`selectAsActiveTask`:

```ts
const watchGoal = useCallback(
  async (goal: Goal) => {
    const goalTasks = tasksByGoal[goal.id] ?? [];
    const target = pickCurrentTask(goalTasks) ?? goalTasks[0];
    if (!target) return;
    setSelectedGoalId(null);
    setStepsExpanded(true);
    await selectAsActiveTask(target.id);
  },
  [tasksByGoal, selectAsActiveTask],
);
```

(`pickCurrentTask(goalTasks) ?? goalTasks[0]` mirrors the exact fallback the existing
`currentTask` memo already uses for a manually-selected goal — reuse that logic, don't
invent a new tie-break.)

In the `goalCards` render loop (~line 214), add a button next to the existing delete button
inside `.plover-home-task-row`, visible only when `!isActive` (mirroring how the subtask
`StepRow` button only shows when `state !== 'current'`) and only when the goal actually has
tasks (`(tasksByGoal[goal.id] ?? []).length > 0` — nothing to watch otherwise). Must call
`e.stopPropagation()` (same as the existing delete button) so it doesn't also trigger the
row's own `onClick` (select-goal-and-expand):

```tsx
{!isActive && (tasksByGoal[goal.id] ?? []).length > 0 && (
  <button
    type="button"
    className="plover-home-task-row__watch"
    onClick={(e) => {
      e.stopPropagation();
      void watchGoal(goal);
    }}
    title="Watch this"
    aria-label="Watch this"
  >
    {/* same 14x14 target/dot-in-ring SVG already used in StepRow.tsx's onSelect button —
        copy it verbatim for visual consistency, this is the app's "watch" icon now */}
  </button>
)}
```

Place it before the existing delete button in the row's trailing button group, so the
order reads watch-then-delete (matches `StepRow`'s existing delete-only precedent of
putting the newer, non-destructive action first when one exists — see how `StepRow.tsx`
puts `onSelect` before `onDelete` in its trailing container).

### `app/src/renderer/main/pages/Home.css`

Add `.plover-home-task-row__watch` (and its `.plover-shell--light` override), copying
`.plover-home-task-row__delete`'s box/padding/border-radius/flex rules exactly, but with a
neutral mint hover instead of red — same pattern as `StepRow.css`'s
`.plover-step__select` vs `.plover-step__delete` (already done in the prior plan; mirror
that exact color choice: `var(--plover-mint)` / `rgba(183, 228, 199, ...)` hover, dark and
light variants).

## Out of scope

- Don't touch `selectAsActiveTask` itself — it's correct as-is and doesn't need the
  `selectedGoalId` clear (verify by reasoning through it, don't just assume): the subtask
  buttons only ever appear inside whichever goal's panel is already showing
  (`activeGoalSteps`, driven by `activeGoalId`), so a subtask click can never target a goal
  other than the one `selectedGoalId` already points to (or `null` if it's the default
  active one) — no staleness possible there. The staleness bug is specific to the new
  goal-row button, which can target a goal that isn't currently selected/active at all.
- Don't change how progress % is computed — confirmed correct above.
- Don't add a similar button to `StepRow`'s already-existing `onSelect` — that one's done.

## Verification

From repo root: `pnpm typecheck && pnpm lint && pnpm test`. Same pattern as the prior three
plans on this branch: commit locally, then pull into `D:\GitHub\Plover` (`git pull
--ff-only <path-to-C:-checkout> feat/sync-companion-active-task-v2`) since that's where the
user actually runs `pnpm dev` to verify visually. Flag this explicitly when reporting back.
