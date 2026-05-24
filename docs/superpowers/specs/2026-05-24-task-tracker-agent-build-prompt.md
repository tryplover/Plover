# Tendril — Coding-Agent Build Prompt (Phase 1)

**Date:** 2026-05-24
**Use:** Paste the section below "## Build Prompt" into Claude Code / Gemini Code / Cursor when you begin implementation. The preamble is for you (the human), not the agent.

---

## Preamble (for the human)

This prompt builds **only Phase 1** (≈ weeks 1–5 of the [product spec](./2026-05-24-task-tracker-agent-product-spec.md) milestone table). The PRD calls the full 12-week hackathon scope "v1" — that includes monitoring, inference, and nudges that this prompt deliberately defers.

Phase 1 covers:

- typed goal capture
- Gemini-powered subtask decomposition
- Google Calendar auto-scheduling
- local todo views
- overlay quick-add

Activity monitoring, voice, Windows parity, and nudges are explicitly **deferred** to later phases. Each subsequent phase should get its own build prompt when you reach it.

---

## Build Prompt

You are building **Tendril**, a local-first task-tracker desktop agent. This prompt covers the **Phase 1**: typed goal capture → Gemini-powered subtask decomposition → Google Calendar auto-scheduling → local todo views → overlay quick-add. Activity monitoring, voice, and Windows parity come in later milestones — do **not** scope-creep into them yet.

### Hard constraints

1. **Local-only data.** SQLite + local filesystem. No backend server. The only outbound HTTP traffic allowed is to `generativelanguage.googleapis.com` (Gemini), `www.googleapis.com` (Calendar), and the Google OAuth endpoints. Add a runtime allowlist check around the HTTP client.
2. **Privacy posture.** Never capture keystroke content. Never upload screenshots anywhere except (later) Gemini Vision with explicit user consent surfaced in settings.
3. **Permissions.** Phase 1 does not need Screen Recording or Accessibility — defer those to the Monitor milestone. Do not request them now.
4. **Module boundaries are load-bearing.** Modules communicate via an in-process event bus and the typed `Store` repositories. No module imports another's internals.

### Tech stack

- **Electron** (latest stable) + **TypeScript** (strict). Main process in TS, renderer in React + TS.
- **better-sqlite3** for the local DB.
- **Google API**: `googleapis` Node SDK for Calendar; OAuth 2.0 desktop flow with a loopback redirect. Tokens stored via OS keychain (`keytar`).
- **Gemini**: `@google/generative-ai` SDK. Use Gemini 2.x with **function/tool calling** for the Planner.
- **Build/dev**: `electron-vite` or `electron-forge`. `pnpm` for package management.
- **Lint/format**: `eslint` + `prettier`. CI on a `pnpm typecheck && pnpm lint && pnpm test` script.
- **Tests**: `vitest` for unit. Do not write integration tests against real Google APIs — record fixtures with `nock` instead.

### File layout

```
app/
  package.json
  electron.vite.config.ts
  src/
    main/
      index.ts                 # app lifecycle, window creation, hotkey
      ipc.ts                   # typed IPC channels
      bus.ts                   # in-process event bus
      store/
        db.ts                  # better-sqlite3 init, migrations
        repos/
          goals.ts             # GoalsRepo
          tasks.ts             # TasksRepo
          sessions.ts          # SessionsRepo (stub for Phase 1)
          activity.ts          # ActivityRepo (stub for Phase 1)
      planner/
        gemini.ts              # Gemini client wrapper, tool defs
        decompose.ts           # goal -> subtasks (uses gemini.ts)
        schedule.ts            # slot-finder
      sync/
        google-auth.ts         # OAuth flow + keychain
        calendar.ts            # Calendar reads/writes
      nudge/
        index.ts               # stub for Phase 1 (no-op except surface API)
    renderer/
      main/
        App.tsx
        pages/
          TasksToday.tsx
          GoalsList.tsx
          Settings.tsx
        components/...
      overlay/
        Overlay.tsx
        QuickAdd.tsx
    shared/
      types.ts                 # Goal, Task, ProgressSignal, etc.
      events.ts                # event-bus event names + payloads
  tests/
    planner/...
    sync/...
    store/...
```

### Data model (SQLite)

```sql
CREATE TABLE goals (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  deadline TEXT,            -- ISO8601
  status TEXT NOT NULL,     -- 'active' | 'paused' | 'done' | 'dropped'
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE tasks (
  id TEXT PRIMARY KEY,
  goal_id TEXT NOT NULL REFERENCES goals(id),
  title TEXT NOT NULL,
  estimate_minutes INTEGER NOT NULL,
  depends_on TEXT,          -- JSON array of task ids
  scheduled_start TEXT,     -- ISO8601, nullable
  scheduled_end TEXT,
  calendar_event_id TEXT,   -- Google event id once scheduled
  status TEXT NOT NULL,     -- 'todo' | 'scheduled' | 'in_progress' | 'done' | 'skipped'
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Stubs for later milestones; create the tables but don't write to them yet:
CREATE TABLE sessions  (id TEXT PRIMARY KEY, task_id TEXT, started_at TEXT, ended_at TEXT);
CREATE TABLE activity  (id INTEGER PRIMARY KEY AUTOINCREMENT, ts TEXT, kind TEXT, payload TEXT);
CREATE TABLE summaries (id INTEGER PRIMARY KEY AUTOINCREMENT, task_id TEXT, ts TEXT, summary TEXT, signal REAL);
```

Migrations live in `store/db.ts` as numbered SQL statements applied in order.

### Module contracts

**`GoalsRepo`** / **`TasksRepo`**: typed CRUD only. No business logic.

**`planner/decompose.ts`**

```ts
export async function decomposeGoal(input: {
  goalText: string;
  now: Date;
  workingHours: { start: string; end: string }; // "09:00" .. "18:00"
}): Promise<{
  goal: Omit<Goal, 'id' | 'created_at' | 'updated_at' | 'status'>;
  subtasks: Array<Omit<
    Task,
    'id' | 'goal_id' | 'status' | 'created_at' | 'updated_at' |
    'scheduled_start' | 'scheduled_end' | 'calendar_event_id'
  >>;
}>;
```

Implementation: single Gemini call with structured-output (JSON schema) or tool-calling. Prompt explicitly forbids subtasks > 4 hrs (split further) and < 15 min (combine).

**`planner/schedule.ts`**

```ts
export async function scheduleTasks(input: {
  tasks: Task[];
  calendarEvents: CalendarEvent[];   // existing events from Sync
  workingHours: { start: string; end: string };
  horizonDays: number;               // e.g. 14
}): Promise<Array<{ taskId: string; start: Date; end: Date }>>;
```

Deterministic greedy slot-finder: walk forward day by day within working hours, skip existing events, place subtasks earliest-fit respecting `depends_on` ordering. **No LLM call here.**

**`sync/calendar.ts`**

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

**Event bus events (Phase 1):**

- `goal.created`, `goal.updated`
- `task.scheduled`, `task.completed`
- `calendar.synced`

### UX requirements (Phase 1)

- Main window has three tabs: **Today**, **Goals**, **Settings**.
- **Today** shows today's scheduled tasks grouped by time, with one-tap mark-done.
- **Goals** lists active goals; expanding one shows its subtasks and overall progress.
- **Settings**: Google account connect/disconnect, working hours, scheduling horizon (days), pause scheduling.
- **Overlay**: invoked by global hotkey (default `⌥-Space` mac, `Alt-Space` win). Single input field, Enter to submit. After submit it shows the proposed subtasks inline for accept/edit. Translucent, frameless, always-on-top, centered.
- A goal entered via overlay flows through the same pipeline as the main window form.

### Acceptance criteria (Phase 1)

A reviewer should be able to:

1. `pnpm install && pnpm dev` and see the app launch on macOS.
2. Click "Connect Google Calendar" in Settings, complete OAuth in browser, token persists to keychain.
3. Press the global hotkey, type "Write a 5-page essay on octopus cognition by next Tuesday", press Enter.
4. See 3–7 subtasks proposed within ~5 seconds. Accept.
5. See those subtasks appear as events on the connected Google Calendar within ~3 seconds.
6. See the same subtasks in the **Today** and **Goals** tabs.
7. Close the app, reopen it, state persists.
8. Run `pnpm test` — unit tests pass with no real network calls.
9. Run `pnpm typecheck && pnpm lint` — clean.

### What to do first

1. Scaffold the Electron + Vite + TS project. Get an empty main window rendering.
2. Add `better-sqlite3` and write the migration runner. Write `GoalsRepo` and `TasksRepo` with unit tests.
3. Build `planner/gemini.ts` with a single hello-world tool-call against Gemini. Then `decomposeGoal` with a focused prompt and a JSON schema. Unit-test with a mocked Gemini client.
4. Build `planner/schedule.ts` as a pure function. Unit-test extensively — this is the part most likely to have edge cases.
5. Build the Google OAuth flow and `calendar.ts`. Use recorded fixtures with `nock` for tests.
6. Wire the renderer: Settings → connect; main form → decompose → schedule → write events.
7. Add the overlay window + global hotkey last, since it depends on everything above.

### What NOT to do

- Don't add activity monitoring, screenshots, voice, or nudges in Phase 1. They have their own milestones.
- Don't add a cloud backend.
- Don't request Accessibility / Screen Recording permissions yet.
- Don't bundle Wispr Flow, Cluely, or any third-party overlay app. Build the overlay with Electron `BrowserWindow` primitives.
- Don't add error handling for impossible states. Validate at the boundaries (user input, Google API responses) and trust internal calls.

### Reporting

After finishing each numbered "what to do first" item, run typecheck + lint + tests and report green before moving on. Use TDD where it helps (Planner and Scheduler — yes; UI scaffolding — no).
