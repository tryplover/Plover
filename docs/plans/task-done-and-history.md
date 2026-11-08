# Finish a task while it runs, and a task history page

> **For agentic workers:** implement Part A, run the checks, then Part B. Run every command from the repo root. Don't commit.

**Goal:**
- **A.** Let the user mark the task they're working on as done from the running screen. Today **Mark done** is only in the ⋯ menu of a saved task, and ticking every step marks the task done but leaves the block running.
- **B.** Add a **History** page listing every finished task: when it was finished, its steps, and how much focus time went into it. It replaces the cramped "Done (n)" list in the popup.

**Read first:** `docs/DESIGN.md` §2.3 (rules), §3.2 (types), §4.4 (saved tasks), §4.12 (welcome page, as a model for an extension page).

## Part A: Mark done while running, plus Undo

1. **Command `task/reopen`** (`{ type: "task/reopen"; taskId: string }`):
   - Add it to `Command` and to the sign-in-gated list in `src/shared/messages.ts`, next to `task/markDone`.
   - The handler in `src/features/tasks/worker.ts` sets `doneAt: null` and `lastActiveAt: now`. It doesn't touch the timer.
   - The reopened task shows in **Your tasks**. It has no `parked`, so Resume starts a fresh block, which is fine.
   - Test it in `tests/features/tasks/worker.test.ts` next to the `task/markDone` tests.
2. **`task/markDone`** keeps its current behaviour for the active task:
   - it sets `doneAt`, clears `parked`, and stops the timer via `stopAndPark`;
   - it also sets `transient.celebrateUntil = now + CELEBRATE_MS`, the same as `step/toggle` when it completes the task, so the buddy celebrates.
   - Check that focus mode and blocking end the same way they do for `timer/stop`. If `timer/stop` ends them, `stopAndPark` already does too; confirm it in a test.
3. **Running screen** (`src/ui/components/Panel.tsx`, the non-idle branch, under `<ActiveSteps>`):
   - When `activeTask` exists, add a `plover-btn-text` button **Mark task done**.
   - It sends `task/markDone` with `activeTask.id`.
   - It shows in both work and break phases.
4. **Undo banner on the idle screen:**
   - After **Mark task done** (and also after **Mark done** in the ⋯ menu of `SavedTasks`), show a `role="status"` row at the top of **Your tasks**: `Done: “<title>”` with an **Undo** button (`autoFocus`) for 5 s.
   - **Undo** sends `task/reopen`.
   - Reuse the delete-undo pattern already in `SavedTasks.tsx` (`UNDO_MS`, the `undoTimer` ref).
   - The Panel button switches the screen to idle, so `SavedTasks` mounts fresh. Pass the "just finished" task id down to it: lift a `justDone: { id, title } | null` state into `Panel`, set it on click, and give it to `SavedTasks` as a prop. Don't add worker state for this.
   - Undo after Mark task done doesn't restart the timer; the task reappears in Your tasks with Resume.

## Part B: History page

1. **Pure logic, TDD**: `src/features/tasks/history.ts`, tested in `tests/features/tasks/history.test.ts`.
   - `taskStats(task, sessions): { blocks: number; focusMs: number }`:
     - `blocks` counts sessions with `taskId === task.id`, `phase === "work"` and `completed`;
     - `focusMs` sums `endedAt - startedAt` over **all** work sessions for the task, completed or cut short.
   - `historyTotals(doneTasks, sessions): { tasks: number; blocks: number; focusMs: number }` sums `taskStats` over the done tasks.
   - `groupDoneByDay(tasks, now): { label: string; tasks: Task[] }[]`:
     - only tasks with `doneAt !== null`, newest first;
     - grouped by local calendar day of `doneAt`;
     - labels are "Today", "Yesterday", then `toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })`, with `year: "numeric"` added when the year isn't `now`'s year;
     - test across a midnight boundary.
   - `formatDuration(ms)` gives "45 m", "1 h 5 m", "0 m" for under a minute. Put it here; nothing like it exists yet.
2. **New entrypoint** `src/entrypoints/history/`:
   - `index.html`: title "Plover history"; copy the welcome page's html shape.
   - `main.tsx`, `history.css`.
   - It's a thin trusted view: it reads state with `useExtensionState()` (with its `ready` guard) and changes it only through `sendCommand`. Call `applyStoredTheme()`, and import `@/ui/base.css`.
   - It's a WXT unlisted page; check that `pnpm build` emits `history.html`. It needs no manifest or permission change.
3. **Layout** (max-width 640px, centred, `--color-bg-page`):
   - **Header:**
     - `plover-eyebrow` "HISTORY";
     - `plover-heading` "What you've finished";
     - a summary line `12 tasks · 31 focus blocks · 13 h 5 m focused` from `historyTotals`, in `--color-text-secondary`.
   - **Day groups:** a small label (Today / Yesterday / date), then one card per task (`--color-bg-surface`, `--radius-card`):
     - the title;
     - the meta line `4 of 4 steps · 3 blocks · 1 h 15 m · 3:42 pm`. The time is `doneAt` as `toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })`;
     - a disclosure button **Steps ▸/▾** (`aria-expanded`) that lists the steps, with done ones shown with a tick (✓) and the rest plain;
     - text buttons **Reopen** (`task/reopen`, then show "Moved back to Your tasks.") and **Delete** (`task/delete`, with the same 5 s Undo that re-saves the task via `task/save`).
   - **Empty state:** "Nothing finished yet. Tasks you finish show up here."
   - **Footer:** **Clear history** asks inline "Delete all N finished tasks? This can't be undone." with **Clear** and **Cancel**. Clear sends `task/clearDone`.
   - Use the existing `.plover-btn-text`, `.plover-eyebrow`, `.plover-heading` classes and only tokens from `src/ui/tokens.css`, so dark mode works.
4. **Popup and panel** (`src/ui/components/SavedTasks.tsx`, `Panel.tsx`):
   - Remove the "Done (n)" expander, its list and the **Clear done** button from `SavedTasks`.
   - In `Panel`, next to the **Settings** link, add a **History** link (`plover-btn-text plover-link`) when any task has `doneAt !== null`. It opens `browser.tabs.create({ url: browser.runtime.getURL("/history.html") })`. This works from both the popup and the panel iframe (they're extension pages; no `tabs` permission is needed to create a tab).
   - `sortSavedTasks` can drop its `done` result if nothing else uses it. Update `parking.test.ts` to match.

## Design doc (same PR)

`docs/DESIGN.md`:
- **§4.4:**
  - add **Mark task done** on the running screen, the Undo banner, and `task/reopen` to the command list;
  - replace "**Done (n)** expands finished tasks with **Clear done**" with a pointer to the History page.
- **New §4.13 History page:** what it shows, the stats definitions above, and Reopen / Delete / Clear history.
- **§2.1:** add the history page to the contexts table as a thin trusted view, next to the welcome page.
- **§9.2 (wrap-up):** where it says "(or **Mark done**)", note that it now includes the running-screen **Mark task done**.
- **§11 History:** one line for this change.
- Delete this plan file.

## Verification
- [ ] `pnpm typecheck && pnpm lint && pnpm test` green.
- [ ] `pnpm build` emits `extension/.output/chrome-mv3/history.html`, and the manifest has no new permissions.
- [ ] No imports of `worker.ts` / `src/worker/*` from `src/ui/**` or the history entrypoint (ESLint enforces it).
