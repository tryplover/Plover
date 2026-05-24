# Feature: Deterministic auto-scheduling

> Read [../core-architecture.md](../core-architecture.md) first.

Place decomposed subtasks into time slots on the user's calendar, respecting working hours, existing events, and inter-task dependencies. Pure local logic — **no LLM call**.

## Scope

- `app/src/main/planner/schedule.ts`.

Consumes the subtasks produced by [subtask-decomposition.md](./subtask-decomposition.md) and the existing-events list returned by [calendar-sync.md](./calendar-sync.md). Returns a plan; doesn't write it. Writing the plan to Google is `calendar-sync`'s job.

## Module contract

```ts
export async function scheduleTasks(input: {
  tasks: Task[];
  calendarEvents: CalendarEvent[];   // existing events from Sync
  workingHours: { start: string; end: string };
  horizonDays: number;               // e.g. 14
}): Promise<Array<{ taskId: string; start: Date; end: Date }>>;
```

## Algorithm

Deterministic greedy slot-finder:

1. Walk forward day by day, starting at `now`, up to `horizonDays`.
2. Inside each day, walk forward through `workingHours`.
3. Skip windows occupied by existing `calendarEvents`.
4. Place subtasks earliest-fit, **respecting `depends_on`** — a task cannot start before all its dependencies have ended.
5. If a task can't fit within `horizonDays`, leave it unscheduled (caller decides what to surface to the user).

No randomness. No LLM. Same inputs ⇒ same outputs.

## Tests

This module is the part of Phase 1 most likely to have edge cases — unit-test extensively. TDD applies. No fixtures needed; the function is pure.

Cases worth covering:
- Empty `calendarEvents`.
- Existing events fully blocking a day.
- A task larger than any single working-hours window.
- Diamond `depends_on` graph (A → B, A → C, B+C → D).
- A task whose `estimate_minutes` straddles the working-hours boundary.

## Acceptance criteria

- Same input → same output (determinism).
- Dependency ordering is preserved: for every (A, B) where `B.depends_on` contains `A`, the returned plan has `A.end <= B.start`.
- Tasks never overlap each other or any input `calendarEvent`.
