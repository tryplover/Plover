# Plan: "Finish" action for the active task in Home

## Context

Plover currently has no direct way to complete the task you're actually working
on. Backend plumbing already exists — `TasksRepo.update` supports `status:
'done'`, the `tasks:updateStatus` IPC handler emits both `task.updated` and
`task.completed`, and `window.api.updateTaskStatus(id, status)` is already
exposed to the renderer ([preload/index.ts](../../app/src/preload/index.ts)).

Two renderer pages already use this plumbing for individual subtasks, but only
via a bullet-toggle buried inside an *expanded* goal's step list:

- [Home.tsx](../../app/src/renderer/main/pages/Home/Home.tsx) `toggleTaskDone`
  (called from `StepRow`'s `onToggleDone`, only visible once a goal is expanded
  and its steps panel is open).
- [GoalsList.tsx](../../app/src/renderer/main/pages/GoalsList/GoalsList.tsx)
  `handleTaskStatusToggle` (same pattern).

Neither page has a "Finish" action on the **active task row itself** — the row
that shows the "WATCHING NOW" badge before you've expanded anything. That's the
gap: user confirmed the scope is Home's active-task row specifically (not the
Companion overlay, which is out of scope for this change).

`pickCurrentTask` ([shared/current-task.ts](../../app/src/shared/current-task.ts))
already determines the single "task Plover is watching right now" across all
goals — ranked `in_progress` > `scheduled` > `todo`, excluding `done`/`skipped`.
Home already computes this as `defaultCurrentTask`, and derives `activeGoalId`
from it. This is the task the new button should finish — not the `currentTask`
variable (which is only set once the goal is expanded, purely for step
highlighting).

## Decided behavior (confirmed with user)

- Add a "Finish" action on the goal row that has `isActive === true` in
  [Home.tsx](../../app/src/renderer/main/pages/Home/Home.tsx), next to the
  existing "Watch this" / delete icon buttons.
- It marks `defaultCurrentTask` (the actual active task, not tied to expansion
  state) as `status: 'done'` via `window.api.updateTaskStatus`.
- After finishing, do **not** auto-advance or auto-expand anything. Whatever
  `pickCurrentTask` naturally resolves to next (if anything) becomes the new
  active goal on the next render, same as today's existing fallback logic —
  but no new goal/task is auto-expanded or auto-selected on the user's behalf.
  The user manually clicks "Watch this" on whichever goal they want next, same
  as the existing flow for switching goals.
- Out of scope: Companion overlay, GoalsList page, goal-level "done" status,
  auto-advance UX.

## Implementation

### 1. `app/src/renderer/main/pages/Home/Home.tsx`

Add a handler alongside the existing `toggleTaskDone`/`selectAsActiveTask`:

```ts
const finishActiveTask = useCallback(async () => {
  if (!defaultCurrentTask) return;
  try {
    await window.api.updateTaskStatus(defaultCurrentTask.id, 'done');
    await fetchData();
  } catch (err) {
    console.error('Failed to finish task:', err);
  }
}, [defaultCurrentTask, fetchData]);
```

Note: `defaultCurrentTask` and `fetchData` are already in scope; no new state
needed.

In the goal row's action-button cluster (where `!isActive` currently renders
the "Watch this" eye button, and the delete button always renders), add a new
button that renders **only when `isActive` is true**, placed before the delete
button:

```tsx
{isActive && (
  <button
    type="button"
    className="plover-home-task-row__finish"
    onClick={(e) => {
      e.stopPropagation();
      void finishActiveTask();
    }}
    title={defaultCurrentTask ? `Finish "${defaultCurrentTask.title}"` : 'Finish current task'}
    aria-label="Finish current task"
  >
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12"></polyline>
    </svg>
  </button>
)}
```

Follow the existing inline-style/className conventions already used by the
`__watch` and `__delete` buttons in this file (same file, same row) rather
than introducing a new pattern — check `Home.css` for the existing
`.plover-home-task-row__watch` / `.plover-home-task-row__delete` rules and add
a sibling `.plover-home-task-row__finish` rule matching their sizing/hover
treatment (a mint/success-tinted hover instead of the delete button's error
tint fits Plover's existing `tone="mint"` progress convention).

### 2. `app/src/renderer/main/pages/Home/Home.css`

Add `.plover-home-task-row__finish` styling as a sibling of the existing
`__watch`/`__delete` button rules, matching their layout (size, padding,
border-radius, transition) with a mint-tinted hover state instead of the
delete button's red tint.

### 3. Tests

No existing test file covers `Home.tsx` (checked `app/tests/renderer/` — only
`App.test.tsx`, `companion/`, `overlay/steps/`, `tokens.test.ts` exist today).
Add `app/tests/renderer/main/pages/Home.test.tsx` following the `window.api`
mocking pattern from `App.test.tsx`:

- Mock `getGoals`/`getTasks` to return one goal with two tasks, one of them
  `status: 'in_progress'` (so it's the active/current task).
  `updateTaskStatus` mocked with `vi.fn().mockResolvedValue(...)`.
- Render `Home`, find the Finish button (`getByLabelText('Finish current
  task')`), click it.
- Assert `window.api.updateTaskStatus` was called with the in-progress task's
  id and `'done'`.
- Assert the Finish button is not present when no goal is active (empty tasks
  list — reuses the existing empty-state early return, so this can be a
  one-line assertion that `queryByLabelText('Finish current task')` is null).

## Verification

Run from repo root:

```
pnpm typecheck && pnpm lint && pnpm test
```

All three must be green. Manual verification via `pnpm dev` is not reliable in
this environment for Electron GUI checks (see CLAUDE.md lessons-learned,
2026-07-17 entry) — rely on the test above plus a careful diff read instead.
