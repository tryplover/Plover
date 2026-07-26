# Plan: broaden which task/goal changes refresh the companion's active task

## Context

Branch: `feat/sync-companion-active-task-v2` (already has the fix landing the companion's
initial active-task sync — see `docs/plans/sync-companion-active-task.md`). Follow-up
request from the user: make the companion also update when tasks are changed *inside the
app* (delete a subtask, delete a goal, etc.), not just on the narrow set of events it
already refetches on.

**Root cause of the gap:** `useCompanionState` refetches via `useAppEvents`, which only
calls its callback for event types in `useAppEvents.ts`'s hardcoded `DEFAULT_EVENTS =
['goal.created', 'task.completed', 'task.scheduled']`. Two separate gaps stack here:

1. `app/src/main/planner/goal-manager.ts`'s `startEventForwarding()` — the only place that
   turns an internal `eventBus` event into an `app-event` IPC broadcast the renderer can
   see at all — only forwards `goal.created`, `goal.updated`, `goal.deleted`,
   `task.scheduled`, `task.completed`, `summary.created`. It does **not** forward
   `task.created`, `task.updated`, `task.deleted`, or `tasks.reordered`, even though all
   four are already emitted on the internal `eventBus` (`ipc.ts`'s `tasks:create`/
   `tasks:update` handlers, and `TasksRepo.delete()`/`.reorder()` in
   `app/src/main/store/repos/tasks.ts`). So deleting a task, editing a task, or creating one
   never reaches *any* renderer window right now — verified by reading
   `app/tests/ipc.test.ts`, which only asserts forwarding for `goal.created`.
2. Even for what *is* forwarded, `useAppEvents`'s `DEFAULT_EVENTS` filter is narrower than
   the forwarded set — `goal.updated`, `goal.deleted`, and `summary.created` are forwarded
   but not in the filter, so no `useAppEvents` consumer (Home or the companion) reacts to
   them either. E.g. deleting a goal in Home (`window.api.deleteGoal`, which does forward
   `goal.deleted`) never reaches the companion because the filter drops it.

Home doesn't currently notice either gap because it calls `fetchData()` directly after its
own delete actions, bypassing the event bus entirely. The companion has no such direct path
— `useAppEvents` is its *only* refresh mechanism — so it's the one exposed by these gaps.

## Files to change

### 1. `app/src/main/planner/goal-manager.ts`

In `startEventForwarding()`, add three more `eventBus.on(...)` blocks mirroring the
existing ones, using the real payload shapes from `app/src/shared/events.ts`:

```ts
eventBus.on('task.created', ({ task }) => {
  broadcast('app-event', { type: 'task.created', payload: { taskId: task.id } });
});

eventBus.on('task.updated', ({ task }) => {
  broadcast('app-event', { type: 'task.updated', payload: { taskId: task.id } });
});

eventBus.on('task.deleted', ({ id }) => {
  broadcast('app-event', { type: 'task.deleted', payload: { taskId: id } });
});

eventBus.on('tasks.reordered', ({ goal_id, orderedIds }) => {
  broadcast('app-event', { type: 'tasks.reordered', payload: { goalId: goal_id, orderedIds } });
});
```

Match the existing forwarders' style (thin `{ taskId }`/`{ goalId }` payloads, not the full
row) — they're informational triggers for a refetch, not a data-sync channel; consumers
already refetch fully via `getTasks()`/`getGoals()` rather than trusting the payload shape.

### 2. `app/src/renderer/hooks/useAppEvents.ts`

Expand `DEFAULT_EVENTS` to the full set of event types `startEventForwarding` now sends,
minus `summary.created` (unrelated to task/goal identity — neither current consumer needs
it, don't add speculative handling):

```ts
const DEFAULT_EVENTS = [
  'goal.created',
  'goal.updated',
  'goal.deleted',
  'task.created',
  'task.updated',
  'task.scheduled',
  'task.completed',
  'task.deleted',
  'tasks.reordered',
];
```

This is a single shared constant used by both `Home.tsx` and `useCompanionState.ts` — no
new parameter/abstraction needed, both callers want the same broadened set (Home
redundantly refetches on events it already handled locally, which is harmless; the
companion is the one that actually needs this).

### 3. Tests

- `app/tests/ipc.test.ts`: add test cases for the three new forwarders (mirror the existing
  `goal.created` forwarding test — emit on `eventBus`, assert `webContents.send` was called
  with the right `app-event` shape) for `task.created`, `task.updated`, `task.deleted`, and
  `tasks.reordered`.
- Grep `app/tests/renderer` for any test asserting the literal `DEFAULT_EVENTS` array
  contents or relying on the companion/Home *not* refetching on, e.g., `task.deleted` — if
  the existing `useCompanionState.test.ts` app-event test only checks `task.completed`,
  consider adding one more case for `task.deleted` triggering a refetch, reusing the same
  pattern as the existing `task.completed` test in that file.

## Out of scope

- Don't add forwarding for `folder.*` or `gdocs.revision` — unrelated to task/goal state,
  no consumer needs them via `useAppEvents`.
- Don't touch `Home.tsx`'s `selectedGoalId` (locally-selected goal, not a data event) — the
  user's ask is about the companion missing *data* changes, not about mirroring which goal
  card Home has manually selected. If the user later wants the companion to follow Home's
  manual goal selection too, that's a separate, bigger feature (cross-window UI-selection
  sync) — flag it as a possible follow-up when reporting back, don't build it now.
- Don't change `summary.created` handling.

## Verification

From repo root: `pnpm typecheck && pnpm lint && pnpm test`.
