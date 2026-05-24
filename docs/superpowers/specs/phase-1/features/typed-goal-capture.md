# Feature: Typed goal capture

> Read [../core-architecture.md](../core-architecture.md) first.

The user types a free-form goal (e.g. *"Write a 5-page essay on octopus cognition by next Tuesday"*) into a form in the main window and presses submit. The text flows through the planner pipeline and the resulting subtasks land on the calendar.

## Scope

- A single text-area form in the renderer that accepts a goal as plain text.
- IPC channel that hands the text to the main process, which persists a `goals` row via `GoalsRepo`, emits `goal.created`, and kicks off decomposition + scheduling.
- The overlay quick-add feeds the **same** pipeline, so the code path between "form submit" and "calendar event written" is shared. See [overlay-quick-add.md](./overlay-quick-add.md).

This doc only covers the main-window form. The downstream Gemini call lives in [subtask-decomposition.md](./subtask-decomposition.md); slot placement lives in [scheduling.md](./scheduling.md); Calendar writes live in [calendar-sync.md](./calendar-sync.md); the rendered result lives in [todo-views.md](./todo-views.md).

## UI placement

The main window has three tabs: **Today**, **Goals**, **Settings**. Goal entry lives in the **Goals** tab (alongside the list of existing goals). After submit, the proposed subtasks render inline for accept / edit, then commit.

## Module touch points

- Writes via `GoalsRepo` (no other module pokes at the `goals` table).
- Emits `goal.created` on success.
- Triggers `decomposeGoal` → `scheduleTasks` → `CalendarSync.createEvent` in sequence.

## Acceptance criteria

- Typing a goal and pressing Enter / Submit lands in the planner pipeline within one IPC round-trip.
- A goal entered via the form ends up identical in shape to one entered via the overlay (same `Goal` row, same downstream events).
