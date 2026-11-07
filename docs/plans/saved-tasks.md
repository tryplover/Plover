# Saved Tasks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep every task visible and resumable, with its time left and Pomodoro cycle position.

**Architecture:** Pure logic in `features/tasks/parking.ts` and `features/timer/machine.ts`; all writes happen in worker handlers through the command queue; the UI gets a `SavedTasks` list in the idle panel and a **Save for later** button. A task's time lives in `timer` while active and in `task.parked` while not.

**Tech Stack:** TypeScript strict, WXT MV3, React, Vitest + `fakeBrowser`.

**Spec:** [docs/superpowers/specs/2026-11-07-saved-tasks-design.md](../superpowers/specs/2026-11-07-saved-tasks-design.md)

## Global Constraints

- Tasks stay in `chrome.storage.local`. No new permissions, hosts or dependencies.
- Exactly one active task; only it has a running timer.
- Every state change goes through a worker handler (`registerHandler`); UI only calls `sendCommand`.
- `src/ui/**` must not import any `worker.ts` or `src/worker/*`.
- No comments unless the why is non-obvious. No migration code: `parked` and `lastActiveAt` are optional.
- Open questions in spec §9 take the spec's defaults: Stop parks; auto-done keeps the block running; Done section exists; focus is not restored on resume.
- Run commands from repo root with `export PATH=~/Library/pnpm:$PATH` first (corepack shim times out). Verify: `pnpm typecheck && pnpm lint && pnpm test`.
- Subagents: never run `git stash`, `git checkout`, `git reset`, `git rebase`, `git clean`, `git restore`. Only `git add <files>` and `git commit`.

## Review Focus

1. Stop pressed after the block's end time but before the alarm fired: the block must be recorded as completed, not parked with stale time (Task 1 test).
2. Park while paused: remaining time measured at `pausedAt` (Task 2 test).
3. Resume while another task runs: the running task is parked first, not lost (Task 3 test).
4. Delete or mark done the active task: timer stops, `activeTaskId` is null (Task 3 tests).
5. Check-in pending when parking: check-in stays pending and its answer ticks the step on the task it was raised for (Task 3 test).

---

## PR stack

| PR | Branch | Tasks |
|---|---|---|
| 0 | `claude/saved-tasks-design` | spec + this plan |
| 1 | `claude/saved-tasks-1-logic` | Tasks 1, 2 |
| 2 | `claude/saved-tasks-2-worker` | Task 3 |
| 3 | `claude/saved-tasks-3-ui` | Task 4 |

---

### Task 1: Overdue stop/skip completes the block first (cleanup follow-up 1)

**Files:**
- Modify: `extension/src/features/timer/worker.ts` (`timer/stop`, `timer/skip` handlers)
- Test: `extension/tests/features/timer/worker.test.ts`

**Interfaces:** Produces internal helper `async function settleOverdue(now: number): Promise<boolean>` in `timer/worker.ts`: runs `tick(timer, config, now)`; if it returns events, applies it and returns `true`.

- [ ] **Step 1: Failing tests**
  - `"stop after the block ended but before the alarm records a completed block"`: `timer/start`, `vi.setSystemTime(T0 + 26 * MIN)` (don't fire the alarm), `timer/stop` → `sessions[0].completed === true`, `sessions[0].endedAt === T0 + 25 * MIN`, `timer.phase === "idle"`.
  - `"skip after the block ended only completes it"`: same setup, `timer/skip` → `timer.phase === "shortBreak"`, `timer.blocksCompleted === 1`, `sessions[0].completed === true`.
- [ ] **Step 2:** `pnpm --filter ./extension exec vitest run tests/features/timer/worker.test.ts` → the two new tests FAIL.
- [ ] **Step 3:** `timer/stop`: `await settleOverdue(now)` then stop the (re-read) timer. `timer/skip`: if `await settleOverdue(now)` returns true, stop there; else skip as today.
- [ ] **Step 4:** Same command → PASS; full timer suite green.
- [ ] **Step 5:** Commit `fix(timer): an overdue stop or skip records the finished block`.

### Task 2: Data model and pure parking logic

**Files:**
- Modify: `extension/src/shared/types.ts`, `extension/src/shared/storage.ts` (`DEFAULT_LOCAL.transient`), `extension/src/features/timer/machine.ts`, `extension/src/features/timer/worker.ts` (`startTimerNow`), `extension/src/features/timer/bookkeeping.ts`
- Create: `extension/src/features/tasks/parking.ts`
- Test: `extension/tests/features/tasks/parking.test.ts` (new), `extension/tests/features/timer/machine.test.ts`, `extension/tests/features/timer/bookkeeping.test.ts`

**Interfaces (produces):**
```ts
// shared/types.ts
export interface ParkedTimer { remainingMs: number; blocksCompleted: number; parkedAt: number }
// Task gains: parked?: ParkedTimer | null; lastActiveAt?: number
// Transient gains: checkInTaskId: string | null   (default null)

// timer/machine.ts
export function startTimer(config: TimerConfig, nowMs: number,
  opts?: { endBy?: number; blocksCompleted?: number }): TimerTransition;

// timer/worker.ts
export async function startTimerNow(endBy?: number, blocksCompleted?: number): Promise<void>;

// tasks/parking.ts
export const MIN_PARK_MS = 30_000;
export function parkedFrom(timer: TimerState, config: TimerConfig, nowMs: number): ParkedTimer | null;
export function resumePlan(task: Task, config: TimerConfig, nowMs: number): { endBy: number; blocksCompleted: number };
export function sortSavedTasks(tasks: Task[], activeTaskId: string | null): { open: Task[]; done: Task[] };
```

- [ ] **Step 1: Failing tests**
  - machine: `startTimer(config, T0, { endBy: T0 + 10*MIN })` → `state.phaseEndsAt === T0 + 10*MIN` and the `phase-started` event `plannedSeconds === 600`; `endBy <= nowMs` is ignored (full 1500 s); `{ blocksCompleted: 3 }` → `state.blocksCompleted === 3` and event `blocksCompleted === 3`.
  - bookkeeping: a `work-block-completed` transition sets `transient.checkInTaskId` to `stored.activeTaskId`.
  - parking `parkedFrom`: idle → `null`; work with 18 min left → `{ remainingMs: 18*MIN, blocksCompleted, parkedAt: now }`; paused work measures `phaseEndsAt − pausedAt`; work with 20 s left → `null`; shortBreak → `{ remainingMs: workMinutes*MIN, blocksCompleted }`.
  - `resumePlan`: with `parked` → `endBy = now + remainingMs`, its `blocksCompleted`; without → `now + workMinutes*MIN`, `0`.
  - `sortSavedTasks`: active task excluded; open sorted by `lastActiveAt ?? createdAt` desc; done (`doneAt !== null`) sorted by `doneAt` desc and not in open.
- [ ] **Step 2:** Run the three test files → FAIL.
- [ ] **Step 3:** Implement. `startTimerNow` passes `{ endBy, blocksCompleted }` into `startTimer` and drops its own `phaseEndsAt` patch. Add `checkInTaskId: null` to `DEFAULT_LOCAL.transient` and set it in `bookkeep` on block completion.
- [ ] **Step 4:** Full `pnpm typecheck && pnpm lint && pnpm test` green.
- [ ] **Step 5:** Commit `feat(tasks): parked timer model and pure parking logic`.

### Task 3: Worker commands

**Files:**
- Modify: `extension/src/shared/messages.ts` (Command union + `COMMAND_TYPES`), `extension/src/features/auth/session.ts` (`GATED_COMMANDS`), `extension/src/features/timer/worker.ts`, `extension/src/features/tasks/worker.ts`
- Test: `extension/tests/features/tasks/worker.test.ts` (register both `registerTimerHandlers()` and `registerTaskHandlers()`), `extension/tests/features/timer/worker.test.ts`

**Interfaces:**
- Consumes: Task 2 signatures.
- Produces commands:
  - `{ type: "task/park" }`
  - `{ type: "task/resume"; taskId: string; endBy?: number }`
  - `{ type: "task/markDone"; taskId: string }`
  - `{ type: "task/delete"; taskId: string }`
  - `{ type: "task/clearDone" }`
- Produces `export async function stopAndPark(now: number): Promise<void>` in `timer/worker.ts` (lives here so `tasks/worker` → `timer/worker` stays the only import direction). It: settles overdue (Task 1), writes `parked = parkedFrom(...)` (skip if the task is done) and `lastActiveAt = now` onto the active task, sets `activeTaskId: null`, applies `stopTimer`, then if `checkInPending` was true before, writes it back to `true` (the `stopped` bookkeeping clears it).
- Gated: add `task/resume`, `task/markDone`, `task/delete`, `task/clearDone` to `GATED_COMMANDS`.

- [ ] **Step 1: Failing tests** (`tasks/worker.test.ts`)
  - `"park keeps the time left"`: save + setActive t1, `timer/start`, advance 5 min, `task/park` → `t1.parked.remainingMs === 20*MIN`, `activeTaskId === null`, timer idle.
  - `"stop parks the active task"`: same with `timer/stop`.
  - `"resume continues from the saved time and cycle"`: t1 with `parked: { remainingMs: 18*MIN, blocksCompleted: 2, parkedAt: T0 }`, `task/resume t1` → `timer.phaseEndsAt === T0 + 18*MIN`, `timer.blocksCompleted === 2`, `t1.parked == null`, `activeTaskId === "t1"`, `t1.lastActiveAt === T0`.
  - `"resume with an earlier endBy shortens the block"`: `endBy: T0 + 10*MIN` → `phaseEndsAt === T0 + 10*MIN`.
  - `"resume parks the running task first"`: t1 running 5 min, `task/resume t2` → `t1.parked.remainingMs === 20*MIN`, `activeTaskId === "t2"`.
  - `"markDone on the active task stops the timer"` → `t1.doneAt === now`, `parked == null`, timer idle, `activeTaskId === null`.
  - `"delete on the active task stops the timer"` → t1 gone, timer idle, `activeTaskId === null`.
  - `"clearDone removes only done tasks"`.
  - `"ticking the last step marks the task done but keeps it active"` → `doneAt === now`, timer still `work`; unticking sets `doneAt` back to `null`.
  - `"task/save sets lastActiveAt"`.
  - `"check-in stays pending after parking and ticks the right task"`: t1 running, fire alarm at 25 min (check-in pending, `checkInTaskId === "t1"`), `task/park` → `transient.checkInPending === true`; then `checkin/answer { stepId: "s1" }` ticks `s1` on t1.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement. `timer/stop` handler calls `stopAndPark(now)`. `task/resume`: if a timer is running, `stopAndPark(now)`; then set `activeTaskId`, clear `parked`, set `lastActiveAt`; `plan = resumePlan(...)`; `startTimerNow(Math.min(plan.endBy, cmd.endBy ?? Infinity), plan.blocksCompleted)`. `step/toggle`: after toggling, `doneAt = steps.length > 0 && steps.every(done) ? (t.doneAt ?? now) : null`. `checkin/answer` targets `transient.checkInTaskId ?? activeTaskId` and resets `checkInTaskId: null`.
- [ ] **Step 4:** Full checks green.
- [ ] **Step 5:** Commit `feat(tasks): park, resume, mark done and delete saved tasks`.

### Task 4: UI — saved task list and Save for later

**Files:**
- Create: `extension/src/ui/components/SavedTasks.tsx`
- Modify: `extension/src/ui/components/Panel.tsx`, `extension/src/ui/components/Panel.css`, `extension/src/ui/components/TimerControls.tsx`, `extension/src/ui/components/CheckIn.tsx` call site in Panel

**Interfaces:** Consumes `sortSavedTasks`, `conflictDuring`, `ConflictOffer`, `formatClock`, Task 3 commands.

- [ ] **Step 1:** `SavedTasks({ tasks, activeTaskId, events, workMinutes, blocksPerLongBreak, now })`, rendered by `Panel` in the idle branch below `TaskBreakdown`. Hidden when both lists are empty.
  - Heading `Your tasks` (`plover-eyebrow` style). Each open row: title; caption `"{done} of {total} steps"` plus `" · Block {blocksCompleted+1} of {blocksPerLongBreak}"` when parked; right side `"{mm:ss} left"` when parked else `formatClock(workMinutes*60)`; **Resume** text button; a `⋯` button toggling **Mark done** / **Delete**.
  - Resume: `conflictDuring(events, now, now + remaining)`; on clash show `ConflictOffer` (shorten → `task/resume` with `endBy`; anyway → without).
  - Delete: row shows `Delete this task?` + **Undo** for 5 s, then sends `task/delete`; Undo cancels.
  - `Done (n) ▸` toggles the done list (title, finished date `toLocaleDateString()`, **Delete**) and a **Clear done** link (`task/clearDone`).
  - Classes: `plover-saved`, `plover-saved-row` (min-height 48px, radius 8px, quiet background on hover using existing CSS variables in `Panel.css`), `plover-saved-meta` (caption type). No new colours.
- [ ] **Step 2:** `TimerControls`: add **Save for later** `plover-btn-text` button sending `task/park`, before Stop.
- [ ] **Step 3:** `Panel`: `CheckIn` gets the task `local.transient.checkInTaskId ?? local.activeTaskId`.
- [ ] **Step 4:** Full checks green; `pnpm build` succeeds.
- [ ] **Step 5:** Commit `feat(ui): saved task list with resume, done and delete`.
