# Stats and task vault

> **For agentic workers:** do Part 1, run the checks, then Part 2. Run every command from the repo root. Don't commit.

**Goal:** Turn the History page into a vault of everything the user has done:
- focus time, Pomodoros, breaks and cycles (today, this week, all time);
- a per-day chart;
- a timeline where each cycle shows its own blocks and times;
- every finished task, searchable;
- export.

Everything stays in `chrome.storage.local` (hard constraint, DESIGN §3.1, §6). There are no new permissions, no new hosts, and the content script gets nothing new.

**Read first:**
- `docs/DESIGN.md` §2.3, §3, §4.4, §4.5, §4.13;
- `extension/src/features/timer/bookkeeping.ts`, `features/timer/worker.ts` (`applyTransition`, `timer/resume`), `features/tasks/history.ts`;
- `entrypoints/task-history/main.tsx`.

## Definitions (use these words in code and UI)

- **Session:** one timer phase that ran: `work`, `shortBreak` or `longBreak`. Stored in `local.sessions`.
- **Cycle:** one sitting, from starting the timer from idle until it goes idle again (Stop, Save for later, Mark task done, or finishing). Every session in it shares a `cycleId`.
- **Pomodoro:** a completed work session.
- **Focus time:** for work sessions, `endedAt - startedAt - pausedMs`.

## Part 1: Record everything (worker + types)

1. **`Session` in `src/shared/types.ts`:** add optional fields. They are read with defaults, so older stored sessions keep working and there's no migration:
   - `cycleId?: string`, default `id`, so an old session is its own cycle;
   - `pausedMs?: number`, default 0;
   - `taskTitle?: string | null`;
   - `skipped?: boolean`, true when the user pressed Skip.
2. **`LocalState`:** add `cycleId: string | null` (default `null`) and `phasePausedMs: number` (default 0) to the type and to the defaults in `src/shared/storage.ts`.
3. **`bookkeep()` (pure, TDD in `tests/features/timer/bookkeeping.test.ts`):**
   - Record a session **for every running phase that ends**, not only work. When `prev.phase !== "idle"` and the phase changes or a new phase starts, push one session for `prev.phase`:
     - `completed`: for work, the existing `work-block-completed` event; for a break, it ran to `phaseEndsAt` (not skipped or stopped);
     - `endedAt`: `prev.phaseEndsAt` when completed, otherwise `prev.pausedAt ?? nowMs`;
     - `pausedMs`: `stored.phasePausedMs`;
     - `cycleId`: `stored.cycleId`;
     - `taskTitle`: the title of the active task, added to `BookkeepingInput` as `activeTaskTitle`;
     - `skipped`: true when the transition came from `skipPhase` (look at the events `skipPhase` emits; if none tells skip apart, pass a `reason` into `bookkeep` from the caller).
   - **Cycle id:** going idle → running sets a new `cycleId` (use `newId()`). Going to idle sets it to `null`. Otherwise keep it.
   - **`phasePausedMs`:** reset to 0 whenever a new phase starts or the timer goes idle.
   - Return `cycleId` and `phasePausedMs` alongside the current fields. `applyTransition` reads and stores them, and also reads the active task's title.
4. **Pause accounting:** in the `timer/resume` handler, before or with the transition, add `now - timer.pausedAt` to `phasePausedMs`. If a phase is stopped or parked while paused, `endedAt` is already `pausedAt`, so don't add the open pause.
5. **Delete keeps stats:** `task/delete` and `task/clearDone` don't touch `sessions`. Because sessions now carry `taskTitle`, stats survive. Old sessions without `taskTitle` show "Untitled task".
6. **New command `stats/clear`** (sign-in gated like the other task commands; add it to `Command`, `COMMAND_TYPES` and `GATED_COMMANDS` in `features/auth/session.ts`). It sets `sessions: []`. Register it in `features/tasks/worker.ts`, and test it.
7. **`historyTotals` / `taskStats`** in `features/tasks/history.ts` must subtract `pausedMs ?? 0` from focus time. Update their tests.

## Part 2: Stats view, vault, export (UI + pure logic)

1. **Pure logic, TDD:** `src/features/stats/stats.ts`, tested in `tests/features/stats/stats.test.ts`. "Local day" and "this week" (Monday start, local time) are computed from `now`.
   - `focusMs(s: Session): number` is 0 for breaks; for work it's `max(0, endedAt - startedAt - (pausedMs ?? 0))`.
   - `summarize(sessions, tasks, from, to)` returns `{ focusMs, pomodoros, shortBreaks, longBreaks, cycles, tasksDone }`:
     - counts sessions whose `startedAt` is in `[from, to)`;
     - `cycles` counts distinct `cycleId ?? id` with at least one work session;
     - `tasksDone` counts tasks with `doneAt` in range.
   - `rangeStart(range: "today" | "week" | "all", now): number`; `all` is 0.
   - `dailyFocus(sessions, now, days = 7): { label: string; dayStart: number; focusMs: number; pomodoros: number }[]`, oldest first. Labels use `toLocaleDateString(undefined, { weekday: "short" })`.
   - `groupCycles(sessions): Cycle[]`, newest first:
     - each `Cycle` is `{ id, startedAt, endedAt, focusMs, pomodoros, breaks, segments: Session[] }`, with segments in time order;
     - its task titles are the distinct `taskTitle`s of its work segments.
   - `toCsv(sessions): string`:
     - header `cycle_id,phase,task,started_at,ended_at,paused_ms,completed,skipped`;
     - ISO times;
     - quote fields containing `,`, `"` or newlines, doubling `"`.
   - `vaultSearch(tasks, query)`: done tasks whose title or any step title contains `query`, case-insensitive. An empty query returns all done tasks.
2. **History page** (`src/entrypoints/task-history/`): add two tabs at the top, **Stats** (default) and **Tasks**, as a `role="tablist"` with `aria-selected`, styled like the Settings `.segmented` control.
   - **Stats tab:**
     - **Range switch** (Today / This week / All time): a segmented control.
     - **Four stat tiles:** Focus time (`formatDuration`), Pomodoros, Breaks (short + long, with "3 short · 1 long" under it), Cycles. Under them, one line: "N tasks finished".
     - **Last 7 days chart:**
       - pure CSS bars, one column per day, bar height proportional to that day's focus;
       - the day label under each bar, the minutes in a `title` attribute and in a visually-hidden table for screen readers;
       - bars use `--color-action-brand-bg`, today's bar is outlined, empty days show a 2px stub.
     - **Cycles timeline:** newest first, 20 at a time with **Show more**. Each cycle is a card:
       - header: date and time range (`Tue 10 Nov · 9:02–10:47 am`);
       - summary: `3 pomodoros · 2 breaks · 1 h 15 m focus`;
       - task names;
       - a horizontal strip of its segments, widths proportional to duration (minimum 4px):
         - work in `--color-action-brand-bg`;
         - short breaks amber `#e3b55b` (the buddy clock's break colour);
         - long breaks `--color-border-control`;
         - skipped or cut-short segments at 50% opacity;
       - under the strip, a `<details>` **Blocks** list: `Work · 9:02–9:27 · 25 m`, `Short break · 9:27–9:32 · 5 m (skipped)`, and so on.
     - **Empty state:** "No sessions yet. Start a focus block and your stats show up here."
   - **Tasks tab:** the current finished-task list (day groups, cards, Reopen/Delete/Undo), plus a search field on top ("Search past tasks") using `vaultSearch`. With a query, show a flat list of matches instead of day groups.
   - **Footer, both tabs:**
     - **Export:** two text buttons, **Download CSV** (`toCsv(local.sessions)`) and **Download JSON** (`{ exportedAt, tasks, sessions }`, pretty-printed). Each builds a `Blob`, makes an object URL and clicks a temporary `<a download="plover-sessions-YYYY-MM-DD.csv">`. This needs no `downloads` permission.
     - **Clear history:** the confirm now has a checkbox "Also clear focus stats" (unchecked by default). Clear sends `task/clearDone`, and also `stats/clear` when the box is checked.
   - Keep the page a thin trusted view: it reads with `useExtensionState()` and writes only via `sendCommand`. Use existing tokens and classes so dark mode works.
   - If `main.tsx` passes ~300 lines, split it into `stats-tab.tsx` and `tasks-tab.tsx` in the same folder.

## Design doc (same PR)

- **§3.2:** the new `Session` fields, `LocalState.cycleId` / `phasePausedMs`, and the definitions above (session, cycle, Pomodoro, focus time).
- **§4.5:** every phase is recorded; pause time is excluded from focus.
- **§4.13:** rewrite it for Stats/Tasks tabs, the chart, the timeline, search, export, and clearing stats. Add `stats/clear` to the commands.
- **§3.1:** one sentence on size: a session is ~150 B, so years of use fit in the 10 MB quota, and `unlimitedStorage` (no install warning) is the fallback if ever needed.
- **§11:** one line.
- Remove the §9 "Stats and task vault" entry (it ships here), and delete this plan.

## Verification
- [ ] `pnpm typecheck && pnpm lint && pnpm test` green, with new tests for `bookkeep` (break sessions, cycle id lifecycle, pausedMs, skipped), `stats.ts`, `stats/clear` and the focus-time change in `history.ts`.
- [ ] `pnpm build` passes, and the manifest has no new permissions.
- [ ] Report the files changed and anything you deviated from.
