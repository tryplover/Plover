# Feature: Local todo views (Today / Goals / Settings)

> Read [../core-architecture.md](../core-architecture.md) first.

The main Electron window. Three tabs that let the user see what's scheduled today, drill into goals + their subtasks, and manage settings.

## Scope

- `app/src/renderer/main/App.tsx` and `app/src/renderer/main/pages/`:
  - `TasksToday.tsx`
  - `GoalsList.tsx`
  - `Settings.tsx`

Reads via IPC from `GoalsRepo` and `TasksRepo`. Subscribes to bus events (`task.scheduled`, `task.completed`, `calendar.synced`) for live updates.

## UX

### Today

- Shows today's scheduled tasks **grouped by time**.
- One-tap mark-done per task (updates `tasks.status` → `'done'`, emits `task.completed`).

### Goals

- Lists active goals.
- Expanding a goal shows its subtasks and an overall progress indicator (count done / total).
- Goal entry form lives here — see [typed-goal-capture.md](./typed-goal-capture.md).

### Settings

- Google account: **connect / disconnect** (hands off to [calendar-sync.md](./calendar-sync.md)).
- Working hours: `start` / `end` (`"09:00"` / `"18:00"`).
- Scheduling horizon: integer days (default 14).
- Pause scheduling toggle.

## Tests

UI scaffolding does **not** require TDD. Cover only non-trivial state logic (e.g. progress calculation) with unit tests.

## Acceptance criteria

- After a goal is decomposed and scheduled, its subtasks appear in both **Today** (for today's slots) and **Goals** (under the goal).
- Marking a task done in Today is reflected in Goals' progress count and survives an app restart.
