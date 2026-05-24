# Store layer

> Read [core-architecture.md](./core-architecture.md) first. The SQLite schema lives there; this doc covers how it's accessed.

Infrastructure, not a user-facing feature. Every Phase 1 feature reads or writes through this layer.

## Scope

- `app/src/main/store/db.ts` — `better-sqlite3` init + migration runner.
- `app/src/main/store/repos/goals.ts` — `GoalsRepo`.
- `app/src/main/store/repos/tasks.ts` — `TasksRepo`.
- `app/src/main/store/repos/sessions.ts` — `SessionsRepo` (Phase 1 stub — table exists; no writes yet).
- `app/src/main/store/repos/activity.ts` — `ActivityRepo` (Phase 1 stub — table exists; no writes yet).

## Module contract

Each repo exposes **typed CRUD only**. No business logic, no cross-table joins beyond foreign-key reads, no event emission (the caller emits events on the bus). The architecture rule from [core-architecture.md](./core-architecture.md#module-boundaries) is load-bearing: **no module reaches into raw SQLite outside this layer**.

```ts
// GoalsRepo
create(input: Omit<Goal, 'id' | 'created_at' | 'updated_at'>): Goal;
get(id: string): Goal | null;
list(filter?: { status?: Goal['status'] }): Goal[];
update(id: string, patch: Partial<Goal>): Goal;

// TasksRepo
create(input: Omit<Task, 'id' | 'created_at' | 'updated_at'>): Task;
get(id: string): Task | null;
listByGoal(goalId: string): Task[];
listScheduledBetween(start: Date, end: Date): Task[];
update(id: string, patch: Partial<Task>): Task;
```

IDs are generated inside the repo (UUID v7 or ULID — pick one and stay consistent). `created_at` / `updated_at` are set by the repo, not the caller.

## Migrations

Numbered SQL statements applied in order on app startup. Run inside `db.ts`:

- Keep one migration per file or per numbered constant; never edit an applied migration — add a new one.
- Migration 001 creates all tables from [core-architecture.md → Data model](./core-architecture.md#data-model-sqlite), including the Phase 2 stub tables (`sessions`, `activity`, `summaries`).
- A `_migrations` table tracks applied versions.

## Tests

TDD applies (the core architecture doc lists `Store` under the TDD-required parts).

Cases worth covering:

- Migration runner: applies in order, is idempotent, refuses to downgrade.
- Repo create/get round-trip — every column survives a round trip and ISO timestamps deserialize correctly.
- `depends_on` JSON column: arrays serialize/deserialize.
- Foreign-key: deleting a goal with tasks behaves as designed (Phase 1: don't delete goals — soft-status only).
- `listScheduledBetween` boundary inclusivity.

No fixtures needed — use an in-memory `better-sqlite3` database (`:memory:`) per test.

## Acceptance criteria

- `pnpm test` covers migrations and both repos with no real filesystem writes.
- App restart preserves all `goals` and `tasks` rows (cross-checked by the cross-cutting acceptance criterion in [core-architecture.md](./core-architecture.md#cross-cutting-acceptance-criteria)).
- Coverage gate on `src/main/store/**` ≥ 60% (per CLAUDE.md's coverage rules).

## Consumers

- [features/typed-goal-capture.md](./features/typed-goal-capture.md) — writes via `GoalsRepo`.
- [features/subtask-decomposition.md](./features/subtask-decomposition.md) — its output is persisted via `TasksRepo` by the IPC caller.
- [features/scheduling.md](./features/scheduling.md) — reads tasks, writes scheduled times back via `TasksRepo`.
- [features/calendar-sync.md](./features/calendar-sync.md) — writes `tasks.calendar_event_id` after successful event creation.
- [features/todo-views.md](./features/todo-views.md) — reads via both repos.
- [features/overlay-quick-add.md](./features/overlay-quick-add.md) — same pipeline as `typed-goal-capture`.
