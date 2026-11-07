# Saved tasks: keep every task and its time left

**Status:** Design, not implemented. **Date:** 2026-11-07.
**Extends:** [pivot spec](2026-10-02-desktop-buddy-pivot-spec.md) §4.2 (task breakdown) and §4.3 (Pomodoro timer).
**Builds on:** the cleanup stack (#483–#488): `features/timer/bookkeeping.ts`, `ui/components/ActiveSteps.tsx`.

## 1. Problem

Tasks are already saved: every task the user starts is written to `chrome.storage.local` (`LocalState.tasks`) with its steps. But the extension only ever shows the **active** task (`activeTaskId`):

- When the timer stops, the popup goes back to "What are you working on?" and the old task is no longer visible anywhere.
- Starting a new task replaces `activeTaskId`, so the previous task has no way back.
- The timer belongs to the session, not to a task. If you stop halfway through a 25-minute block, the remaining time is gone, and coming back to that task starts a fresh 25 minutes.

The user wants to switch between tasks without losing them, and to come back to a task where they left it: same steps ticked, same time left.

## 2. Goals and non-goals

**Goals**
1. Every unfinished task stays visible and can be resumed from the popup and the in-page panel.
2. A task remembers the time left in its current work block, and resuming continues from there.
3. A task remembers how far it is through its Pomodoro cycle (`blocksCompleted`), so long breaks still come after every 4 blocks of *that* task.
4. Finished tasks stay visible, collapsed, until the user clears them.
5. Behaviour unchanged when the user only ever works on one task at a time.

**Non-goals**
- No cloud sync of tasks. They stay in `chrome.storage.local` (spec §4.8, hard constraint).
- No running two timers at once. Exactly one task is active, and only it has a running timer.
- No due dates, priorities, projects or reordering of the task list (later, if ever).
- No saving of break time. A task parked during a break resumes with a fresh work block (see §5.3).
- No history, stats or analytics views built on `sessions`.

## 3. User experience

### 3.1 Idle screen (popup and in-page panel)

Below "What are you working on?" and the input, a new **Your tasks** section lists saved tasks, most recently worked on first:

```
PLOVER · TODAY
        (bird)
What are you working on?
[ e.g. Write the intro of my essay ]
[Suggest steps]  Write my own

YOUR TASKS
┌───────────────────────────────────────────┐
│ History essay: the intro        18:42 left│  ← task row, quiet bg on hover
│ 1 of 4 steps · Block 2 of 4      [Resume] │
├───────────────────────────────────────────┤
│ Problem set 3                   25:00     │
│ 0 of 3 steps                     [Resume] │
└───────────────────────────────────────────┘
Done (2) ▸                                     ← collapsed
```

- Each row shows: title, steps done / total, the time left in its block (or the full work length if it has none saved), and **Resume**.
- A row menu (⋯) offers **Mark done** and **Delete**. Delete asks for confirmation in place ("Delete this task? Undo" for 5 seconds), with no modal dialog.
- **Done (n)** expands to finished tasks (title, finished date, **Delete**). A **Clear done** link removes them all.
- Empty state: the section is hidden when there are no saved tasks. The screen then looks like today.
- Styling: Figma App MVP components. Rows use the Task row style (48px min, radius 8, quiet background on hover), the time is Caption type, and **Resume** is a Text button. No new visual primitives.

### 3.2 While a task is running

Same as today (title, steps, timer, focus toggle), plus a **Save for later** text button next to Pause / Skip / Stop:

- **Save for later** parks the task: its time left and cycle position are saved, the timer stops, focus mode and blocking turn off as they do for Stop, and the popup returns to the idle screen with the task at the top of **Your tasks**.
- **Stop** now also parks the task (same as Save for later). Today Stop throws the remaining time away. Keeping it is cheaper than asking, and **Mark done** or **Delete** cover the "I'm finished with this" case.
- When the last step is ticked, the existing celebration plays and the task is marked done automatically, but stays active until the timer is stopped or the block ends, so the user isn't kicked out mid-block.

### 3.3 Starting a new task while one is active

The task input is only shown while idle, so there's no direct conflict. With focus mode on, the in-page panel and popup show the running task; the user saves it for later first. (A "switch to…" shortcut from the running view is out of scope for v1.)

### 3.4 Resume

**Resume** on a saved task:
1. If another task is active and running, it is parked first (same as Save for later).
2. The task becomes active.
3. The timer starts a **work** phase that ends at `now + savedRemainingMs` (or a full work block if nothing is saved), with `blocksCompleted` restored.
4. If focus mode was on when the task was parked, it is *not* restored automatically; the focus toggle is right there.

## 4. Data model

`Task` gains two optional fields. Existing stored tasks simply don't have them, so no migration is needed (`noUncheckedIndexedAccess`-safe reads with defaults).

```ts
export interface Task {
  id: string;
  title: string;
  steps: Step[];
  createdAt: number;
  doneAt: number | null;
  /** Saved work-block position, or null/absent if the task has none. */
  parked?: ParkedTimer | null;
  /** For sorting "Your tasks": last time this task was active. */
  lastActiveAt?: number;
}

export interface ParkedTimer {
  /** Milliseconds left in the work block when the task was parked (> 0). */
  remainingMs: number;
  /** Work blocks this task has completed in its current cycle. */
  blocksCompleted: number;
  parkedAt: number;
}
```

`LocalState` keeps `activeTaskId` and the single global `timer`. A task's time lives in `timer` while it's active and in `task.parked` while it isn't. Exactly one place holds it at any moment.

**Storage budget:** a task with 10 steps is ~1 KB, and `storage.local` allows 10 MB, so no pruning is needed for v1. Done tasks older than 30 days could be pruned on `reconcile` later; not in v1.

## 5. Behaviour

### 5.1 Pure logic (new `features/tasks/parking.ts`, no `chrome.*`, unit-tested)

```ts
/** Snapshot of the active task's timer, or null if there is nothing worth saving. */
export function parkedFrom(timer: TimerState, nowMs: number): ParkedTimer | null;

/** The `endBy` and starting cycle to resume a task with. */
export function resumePlan(
  task: Task,
  config: TimerConfig,
  nowMs: number,
): { endBy: number; blocksCompleted: number };

/** "Your tasks" order and the done split. */
export function sortSavedTasks(tasks: Task[], activeTaskId: string | null):
  { open: Task[]; done: Task[] };
```

Rules:
- `parkedFrom`: only a **work** phase is saved. Remaining = `phaseEndsAt − (pausedAt ?? now)`, floored at 0. If remaining < 30 s, it returns `null` (the block is effectively over; resume starts fresh). Break phases return `{ remainingMs: full work length, blocksCompleted }`, so the cycle position is kept but not the break.
- `resumePlan`: `endBy = now + (task.parked?.remainingMs ?? config.workMinutes × 60 000)`, `blocksCompleted = task.parked?.blocksCompleted ?? 0`.
- `sortSavedTasks`: open = not done and not active, by `lastActiveAt ?? createdAt` descending; done = `doneAt !== null`, by `doneAt` descending.

### 5.2 Worker (new commands, all through the single command queue)

| Command | Effect |
|---|---|
| `task/park` | If a task is active: write `parkedFrom(timer)` and `lastActiveAt = now` onto it, clear `activeTaskId`, stop the timer (focus and blocking turn off via the existing `stopped` listener). |
| `task/resume { taskId }` | Park the current active task if any, set `activeTaskId = taskId`, clear `task.parked`, set `lastActiveAt`, start the timer with `resumePlan` (`startTimerNow(endBy)` plus a `blocksCompleted` override). |
| `task/markDone { taskId }` | Set `doneAt = now`, clear `parked`. If it's the active task, also stop the timer. |
| `task/delete { taskId }` | Remove the task. If it's the active task, stop the timer and clear `activeTaskId`. |
| `task/clearDone` | Remove all tasks with `doneAt !== null`. |
| `timer/stop` (changed) | Parks the active task (as `task/park`) before stopping. |

All are gated behind sign-in like the existing task commands (`isGated`). `task/save` (used when starting a new task) stays as is, plus it sets `lastActiveAt`.

**Timer start with a saved cycle:** `startTimer` always begins at `blocksCompleted: 0`. Add an optional `blocksCompleted` argument to `startTimer` in `machine.ts` (pure, tested) rather than patching state in the worker. `startTimerNow(endBy)` already shortens the first phase; it should also report the shortened `plannedSeconds` in its `phase-started` event. That fixes the existing endBy/plannedSeconds mismatch (follow-up 4 from the cleanup review) as part of this work.

**Sessions:** `bookkeep()` already records a work session when leaving work. Parking goes through `stopTimer`, so a partial block is logged with `completed: false`, which is correct.

### 5.3 Edge cases

| Case | Behaviour |
|---|---|
| Park while paused | Remaining is measured at `pausedAt`, so pause time isn't lost. |
| Park during a break | No time saved. Resume starts a full work block, cycle position kept. |
| Park with < 30 s left | Treated as no time saved. |
| Block ended while the worker slept, then the user parks | `reconcileTimer` ticks first, so the block is completed (check-in pending) and nothing stale is saved. Resolve via the overdue-stop fix (cleanup follow-up 1) before shipping. |
| Check-in pending when parking | The check-in stays pending and is answered against the task it belongs to: `checkin/answer` must use the task the check-in was raised for, not `activeTaskId`. Store `checkInTaskId` in `transient` when the check-in is raised. |
| Calendar conflict on resume | Resume runs the same conflict check as starting a task (`ConflictOffer`: shorten to end before the event, or start anyway). |
| Active task deleted from another view | Timer stops, popup shows the idle screen. |
| Two popups or panels open | Both re-render from storage changes. All writes go through the worker queue, so there are no races. |
| Old stored tasks | No `parked` and no `lastActiveAt`: they show with the full work length and sort by `createdAt`. |

## 6. Architecture fit

- All state changes happen in the service worker through the command queue (spec §6). The UI only sends commands.
- Pure logic lives in `features/tasks/parking.ts` and `features/timer/machine.ts`, with TDD, under the coverage gate.
- UI: a new `ui/components/SavedTasks.tsx` rendered by `Panel` in the idle branch, below `TaskBreakdown`. A **Save for later** button in `TimerControls`.
- Content script unaffected: it still draws only the buddy. Saved tasks appear in the in-page panel because the panel is the same `Panel`.
- No new permissions, hosts or dependencies.

## 7. Testing

- **Unit:** `parkedFrom` (work, paused, break, < 30 s, idle), `resumePlan` (with and without saved time), `sortSavedTasks`, `startTimer` with `blocksCompleted`, and `plannedSeconds` with `endBy`.
- **Worker:** park → resume round trip keeps remaining time and cycle; Stop parks; resume parks the current task first; markDone and delete on the active task stop the timer; check-in answered against the right task after parking.
- **Manual (Playwright, as in the release checks):** start task A, run 5 min, Save for later, start task B, resume A and confirm about 20:00 left and the steps intact; reload the extension and confirm the list survives; dark mode.

## 8. Delivery (stack of PRs)

1. **Pure logic + data model:** `Task.parked`/`lastActiveAt`, `parking.ts`, `startTimer` cycle argument and the `plannedSeconds` fix, with tests. No behaviour change yet.
2. **Worker commands:** `task/park`, `task/resume`, `task/markDone`, `task/delete`, `task/clearDone`, Stop parks, `checkInTaskId`. Tests.
3. **UI:** the `SavedTasks` list, Save for later, Done section and delete-undo, in Figma styles; screenshots in the PR.
4. **Spec:** fold this into the pivot spec §4.2/§4.3 once shipped.

Before PR 2: land cleanup follow-up 1 (overdue stop/skip records a finished block as abandoned), since parking goes through Stop.

## 9. Open questions

1. **Should Stop park, or should it discard as today?** This design parks (saving is the safer default). The alternative is a separate Save for later button and Stop keeping its current meaning.
2. **Should auto-done on the last step end the block?** This design keeps the block running until the timer stops.
3. **Should the `Done` section exist?** Alternatively, finished tasks could disappear after the celebration.
4. **Restore focus mode on resume?** This design says no.
