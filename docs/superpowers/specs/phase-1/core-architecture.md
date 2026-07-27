# Plover — Phase 1 Core Architecture

Cross-cutting architecture, constraints, and conventions for **Phase 1** of Plover. Read this first; feature specifications assume this document as authoritative.

The product motivation lives in the [product spec](../2026-05-24-task-tracker-agent-product-spec.md).

## Phase 1 scope

Phase 1 covers exactly:

- typed goal capture
- Gemini-powered subtask decomposition
- Deterministic local scheduling (working-hours aware)
- Google Docs integration (OAuth + metadata/revision polling)
- Local todo views (Today / Goals / Settings)
- Overlay quick-add (global hotkey)

**Deferred to later phases — do not add yet:**

- Activity monitoring (screenshots, window titles, keystroke counts)
- Voice input (`whisper.cpp`)
- Inference / progress signals
- Nudge engine
- Windows port
- Multi-account, plugins, multi-device sync

## Runtime flow

The flowchart below shows the Phase 1 system modules and the external endpoints that any outbound HTTP must come from (see "Hard constraints" below).

### Module map + external endpoints

![Module map + external endpoints](../../../diagrams/core-architecture.svg)

### Goal → schedule sequence

![Goal → schedule sequence](../../../diagrams/seq-diagram.svg)

Notes:

- Every external arrow is one of the allowlisted hosts in "Hard constraints". Nothing else should make outbound calls.
- `Planner.schedule` is intentionally pure — no DB, no network — which is why it has a self-loop. It's the most-tested module for that reason.

## Hard constraints

1. **Local-only data.** SQLite + local filesystem. No backend server. The only outbound HTTP traffic allowed is to `generativelanguage.googleapis.com` (Gemini), `www.googleapis.com` (Docs/Drive), and the Google OAuth endpoints. Add a runtime allowlist check around the HTTP client.
2. **Privacy posture.** Never capture keystroke content. Never upload screenshots anywhere except (later) Gemini Vision with explicit user consent surfaced in settings.
3. **Permissions.** Phase 1 does not need Screen Recording or Accessibility — defer those to the Monitor milestone. Do not request them now.
4. **Module boundaries are load-bearing.** Modules communicate via an in-process event bus and the typed `Store` repositories. No module imports another's internals.

## Tech stack

- **Electron** (latest stable) + **TypeScript** (strict). Main process in TS, renderer in React + TS.
- **better-sqlite3** for the local DB.
- **Google API**: `googleapis` Node SDK for Google Docs metadata/revisions; OAuth 2.0 desktop flow with a loopback redirect. Tokens stored via OS keychain (`keytar`).
- **Gemini**: `@google/generative-ai` on hosted proxy. Use Gemini 2.x with function/tool calling for the Planner.
- **Build/dev**: `electron-vite`. `pnpm` for package management.
- **Lint/format**: `eslint` + `prettier`. CI on a `pnpm typecheck && pnpm lint && pnpm test` script.
- **Tests**: `vitest` for unit. Do not write integration tests against real Google APIs — record fixtures with `nock` instead.

## File layout

```
app/
  package.json
  electron.vite.config.ts
  src/
    main/
      index.ts                 # app lifecycle, window creation, hotkey
      ipc/                     # typed IPC channels (split by domain)
        goals.ts
        tasks.ts
        auth.ts
        settings.ts
        system.ts
      events/
        bus.ts                 # in-process event bus
      store/
        db.ts                  # better-sqlite3 init, migrations
        repos/
          goals.ts             # GoalsRepo
          tasks.ts             # TasksRepo
          sessions.ts          # SessionsRepo (stub for Phase 1)
          activity.ts          # ActivityRepo (stub for Phase 1)
      planner/
        decompose.ts           # goal -> subtasks
        schedule.ts            # slot-finder
        goal-manager.ts        # save/delete goal and tasks orchestrator
      sync/
        google-auth.ts         # OAuth flow + keychain
        gdocs-poller.ts        # Google Docs revisions poller
      nudge/
        index.ts               # stub for Phase 1 (no-op except surface API)
    renderer/
      main.tsx                 # renderer entry
      App.tsx
      main/
        pages/
          Home/                # Today task view
          GoalsList/           # Goals view
          Settings/            # Settings view
      overlay/
        Overlay.tsx
    shared/
      types.ts                 # Goal, Task, etc.
      events.ts                # event-bus event names + payloads
  tests/
    planner/...
    sync/...
    store/...
```

## Data model (SQLite)

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
  calendar_event_id TEXT,   -- [DEPRECATED] Leftover column from Calendar sync
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

## Module boundaries

- **`Store`** (`main/store/`) exposes typed repos: `GoalsRepo`, `TasksRepo`, `SessionsRepo`, `ActivityRepo`. Typed CRUD only — no business logic. No module reaches into raw SQLite.
- **`Planner`** (`main/planner/`) is pure logic: `decompose` calls Gemini; `schedule` is a deterministic local function. Side effects only via `Store` and `Sync`.
- **`Sync`** (`main/sync/`) is the **only** module that talks to Google APIs.
- **`Nudge`** (`main/nudge/`) is a Phase 1 stub — surface the API, no behavior.

Modules communicate via the in-process event bus + typed `Store` repos. No module imports another module's internals.

### Event bus events (Phase 1)

- `goal.created`, `goal.updated`, `goal.deleted`
- `task.created`, `task.updated`, `task.scheduled`, `task.completed`, `task.deleted`
- `gdocs.revision`

## Implementation order

Do the steps in this order. Each builds on the previous; don't jump ahead.

1. Scaffold the Electron + Vite + TS project. Get an empty main window rendering.
2. Add `better-sqlite3` and write the migration runner. Write `GoalsRepo` and `TasksRepo` with unit tests. See [store-layer.md](./store-layer.md).
3. Build `planner/decompose.ts` with a single hello-world tool-call against Gemini. Then `decomposeGoal` with a focused prompt and a JSON schema. Unit-test with a mocked Gemini client.
4. Build `planner/schedule.ts` as a pure function. Unit-test extensively — this is the part most likely to have edge cases.
5. Build the Google OAuth flow and `gdocs-poller.ts`. Use recorded fixtures with `nock` for tests.
6. Wire the renderer: Settings → connect; main form → decompose → schedule → write events.
7. Add the overlay window + global hotkey last, since it depends on everything above.

## What NOT to do

- Don't add activity monitoring, screenshots, voice, or nudges in Phase 1. They have their own milestones.
- Don't add a cloud backend for user data.
- Don't request Accessibility / Screen Recording permissions yet.
- Don't bundle Wispr Flow, Cluely, or any third-party overlay app. Build the overlay with Electron `BrowserWindow` primitives.
- Don't add error handling for impossible states. Validate at the boundaries (user input, Google API responses) and trust internal calls.

## Cross-cutting acceptance criteria

These apply to Phase 1 as a whole.

1. `pnpm install && pnpm dev` launches the app on macOS.
2. Close the app, reopen it — state persists.
3. `pnpm test` passes with no real network calls.
4. `pnpm typecheck && pnpm lint` is clean.
