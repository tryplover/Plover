# Feature: Overlay quick-add

> Read [../core-architecture.md](../core-architecture.md) first.

A global hotkey summons a translucent, frameless, always-on-top window. Type a goal, press Enter, see proposed subtasks inline, accept. Same downstream pipeline as the main-window form.

Build this **last** — it depends on goal capture, decomposition, scheduling, and calendar sync all working.

## Scope

- `app/src/renderer/overlay/Overlay.tsx` and `QuickAdd.tsx` — renderer.
- Global hotkey registration + `BrowserWindow` creation in `app/src/main/index.ts`.

## UX

- **Hotkey**: default `⌥-Space` on macOS, `Alt-Space` on Windows (Phase 1 ships macOS only; Windows parity is deferred).
- **Window**: translucent, frameless, always-on-top, centered on the active display.
- **Layout**: single input field. Enter submits.
- **After submit**: subtasks render inline for accept / edit, identical in shape to the main-window form.
- Esc dismisses.

## Constraint

Build the overlay with Electron `BrowserWindow` primitives. **Do not** bundle Wispr Flow, Cluely, or any third-party overlay app.

## Module touch points

A goal entered via overlay flows through the **same** code path as one entered in the Goals tab — see [typed-goal-capture.md](./typed-goal-capture.md). The overlay is just a different surface onto the same pipeline:

1. Overlay calls the IPC channel that persists a `Goal` via `GoalsRepo` and emits `goal.created`.
2. Main process runs `decomposeGoal` ([subtask-decomposition.md](./subtask-decomposition.md)) → `scheduleTasks` ([scheduling.md](./scheduling.md)) → `CalendarSync.createEvent` ([calendar-sync.md](./calendar-sync.md)).
3. Result rendered in the overlay for accept / edit, then committed.

## Acceptance criteria

- Pressing the global hotkey shows the overlay regardless of the active app.
- Typing *"Write a 5-page essay on octopus cognition by next Tuesday"* + Enter shows 3–7 subtasks within ~5 s.
- Accepting writes events to Google Calendar within ~3 s and they appear in [todo-views.md](./todo-views.md) Today / Goals.
