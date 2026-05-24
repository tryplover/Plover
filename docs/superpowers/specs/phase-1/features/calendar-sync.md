# Feature: Google Calendar sync

> Read [../core-architecture.md](../core-architecture.md) first.

OAuth into Google Calendar and read/write events. This is the **only** module in Phase 1 that talks to Google APIs — the architecture rule is load-bearing.

## Scope

- `app/src/main/sync/google-auth.ts` — OAuth 2.0 desktop flow with loopback redirect; tokens stored in the OS keychain via `keytar`.
- `app/src/main/sync/calendar.ts` — `CalendarSync` interface implementation against `googleapis`.

Reads existing events for [scheduling.md](./scheduling.md) to avoid. Writes events produced by [scheduling.md](./scheduling.md). Surfaces connect/disconnect in the Settings tab of [todo-views.md](./todo-views.md).

## Module contract

```ts
export interface CalendarSync {
  listEvents(rangeStart: Date, rangeEnd: Date): Promise<CalendarEvent[]>;
  createEvent(input: {
    taskId: string;
    title: string;
    start: Date;
    end: Date;
  }): Promise<string>;  // returns event id
  deleteEvent(eventId: string): Promise<void>;
}
```

After a successful `createEvent`, the caller persists the returned event id onto the `tasks.calendar_event_id` column via `TasksRepo`, and emits `calendar.synced`.

## OAuth flow

- Desktop client + loopback redirect (no electron-side webview hacks).
- Refresh tokens persisted via `keytar` so the user only signs in once.
- Connect / disconnect surfaced in [todo-views.md](./todo-views.md) → Settings.

## Tests

- Use recorded fixtures with `nock`. **No real network calls in tests.**
- Cover OAuth token refresh path, create/delete event happy paths, and 403/401 surface as typed errors.

## Acceptance criteria

- OAuth connect persists across an app restart (token survives in keychain).
- Subtasks appear as events on the connected Google Calendar within ~3 s of acceptance in the UI.
- `nock`-backed unit tests pass with no outbound network.
