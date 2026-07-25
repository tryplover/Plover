# Plan: manual "watch this" button to pick the active task in Home

## Context

Branch: `feat/sync-companion-active-task-v2` (already has the companion sync fixes from
`docs/plans/sync-companion-active-task.md` and
`docs/plans/companion-broader-event-refresh.md`).

User request: a small button in Home to manually pick which specific task is "the" active
task, rather than only relying on the automatic `pickCurrentTask` heuristic (rank
`in_progress` > `scheduled` > `todo`, tie-broken by `scheduled_start`).

**Design decision (flagging as unconfirmed — tell the user when reporting back):** rather
than inventing new state, "select as active" is implemented as **setting that task's status
to `in_progress`** via the already-existing `updateTaskStatus` IPC call. This is not a
workaround — it's exactly what the status value already means. The existing comment on
`TASK_STATUS_RANK` in `app/src/shared/current-task.ts` says: *"There's no real activity
monitoring yet (Phase 2+), so `in_progress` is rarely set by anything today."* A manual
button is precisely the Phase-1-appropriate way to set it, ahead of Phase 2 activity
monitoring doing it automatically. This means:
- No new schema, no new IPC surface, no new sync mechanism — `pickCurrentTask` (shared by
  Home and the companion) already ranks `in_progress` first, and the event-forwarding work
  from the previous two plans already means a `task.updated` broadcast will refresh the
  companion.
- To keep `pickCurrentTask` deterministic (only one `in_progress` task should exist at a
  time — if two are tied at rank 0, the tie-break is `scheduled_start`, which may not be the
  task the user just clicked), selecting a task must **demote any other currently
  `in_progress` task(s)** back down first.

## Bug to fix first: `tasks:updateStatus` doesn't emit `task.updated` for non-`done` transitions

`app/src/main/ipc.ts`'s `tasks:updateStatus` handler currently only emits an event
(`task.completed`) when the new status is `'done'`:

```ts
ipcMain.handle('tasks:updateStatus', async (_, id: string, status: Task['status']) => {
  const task = tasksRepo.update(id, { status });
  if (status === 'done') {
    eventBus.emit('task.completed', task);
  }
  return task;
});
```

Setting a task to `'in_progress'` (or demoting one to `'todo'`/`'scheduled'`) currently
emits **nothing** — which would silently defeat this whole feature, since the companion's
only refresh path is the event bus (same class of bug fixed in the previous two plans).
Fix: also emit `task.updated` for the general case, matching `EventPayloads['task.updated']
= { task: Task }` (already forwarded to the renderer and already in `useAppEvents`'s
`DEFAULT_EVENTS`, per the prior plan):

```ts
ipcMain.handle('tasks:updateStatus', async (_, id: string, status: Task['status']) => {
  const task = tasksRepo.update(id, { status });
  if (status === 'done') {
    eventBus.emit('task.completed', task);
  }
  eventBus.emit('task.updated', { task });
  return task;
});
```

Both events can fire on the same call — nothing downstream treats them as mutually
exclusive (forwarding, `useAppEvents`, and the companion's `refetchTask` all just trigger a
refetch regardless of which event type fired).

## Files to change

### 1. `app/src/main/ipc.ts`

Add the unconditional `eventBus.emit('task.updated', { task })` to `tasks:updateStatus`, as
above.

### 2. `app/src/renderer/components/StepRow.tsx`

Add an optional `onSelect?: () => void` prop, rendered in the existing
`plover-step__trailing-container` alongside `onDelete`/`dragHandleProps` (same conditional
pattern), only when `state !== 'current'` (no point offering to select the task that's
already selected). Use a small icon button styled like `.plover-step__delete` (new class
`.plover-step__select` in `StepRow.css`, same box/hover treatment but a neutral hover color
—not the delete button's red—since this isn't a destructive action). Label/`aria-label`:
`"Watch this"`. Use a simple inline SVG (a target/dot-in-ring icon, small `14x14`, matching
the delete button's icon sizing) rather than a text glyph, for a cleaner look next to the
existing SVG delete icon already used elsewhere in `Home.tsx` (the goal-row delete button
uses inline SVG — match that visual language rather than `StepRow`'s current `✕` text
glyph, since this is a new addition, not an edit to the existing delete button).

### 3. `app/src/renderer/main/pages/Home.tsx`

Add a handler, e.g. `selectAsActiveTask`:

```ts
const selectAsActiveTask = useCallback(
  async (taskId: string) => {
    const others = tasks.filter((t) => t.status === 'in_progress' && t.id !== taskId);
    try {
      await Promise.all(
        others.map((t) =>
          window.api.updateTaskStatus(t.id, t.scheduled_start ? 'scheduled' : 'todo'),
        ),
      );
      await window.api.updateTaskStatus(taskId, 'in_progress');
      await fetchData();
    } catch (err) {
      console.error('Failed to set active task:', err);
    }
  },
  [tasks, fetchData],
);
```

Wire it into the `StepRow` usage in the expanded steps panel (~line 306-331) as
`onSelect={() => void selectAsActiveTask(step.id)}`.

Do not touch `selectedGoalId`/goal-card logic — this only affects which *task* is marked
current within whatever goal's steps panel is currently expanded, not which goal is
expanded.

### 4. Tests

- `app/tests/ipc.test.ts` (or wherever `tasks:updateStatus` is currently tested — grep for
  it): add/update a case asserting `task.updated` is emitted for a non-`done` status change,
  and that `task.completed` is *not* emitted for it (only for `done`).
- `app/tests/renderer/components/StepRow.test.tsx` if it exists (check first): add a case
  for the new `onSelect` button rendering only when `state !== 'current'` and firing the
  callback on click.
- Home.tsx has no existing test file (confirmed in the first plan) — no update needed
  there unless one has since been added; check before assuming.

## Out of scope

- Don't build reordering, editing, or creating tasks from the UI — separate features, not
  requested.
- Don't add a "watch this" affordance at the goal-card level — the request is specifically
  about picking a *task*, and goal selection already exists via clicking a goal row
  (`selectedGoalId`).
- Don't persist "which task the user explicitly picked" as separate state from `status` —
  per the design decision above, `in_progress` status *is* the signal, intentionally.

## Verification

From repo root: `pnpm typecheck && pnpm lint && pnpm test`. As with the prior two plans in
this sequence, this fix will need to be committed and pulled into the user's actual test
checkout at `D:\GitHub\Plover` (same branch, `feat/sync-companion-active-task-v2`) — flag
this explicitly when reporting back, per the established pattern (`git fetch
<path-to-C:-checkout> <branch>` or `git pull --ff-only` from the D: checkout).
