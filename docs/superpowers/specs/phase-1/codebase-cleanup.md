# Codebase Cleanup and Refactoring Scope

This document details the codebase cleanups, code smells, dead code removal, and modularization tasks identified in the Plover repository. These tasks should be executed to ensure the codebase remains clean, maintainable, and aligned with current architectural specs.

## 1. Dead Code and Unused Fields

- **Unused SQLite Column `calendar_event_id`**:
  - **Symptom**: The `tasks` table created in Migration v1 (in `app/src/main/store/db.ts`) contains `calendar_event_id TEXT`. This field was originally used for Google Calendar sync but is no longer present in the TypeScript `Task` interface (`app/src/shared/types.ts`) or used anywhere in the codebase.
  - **Action**: Remove the `calendar_event_id TEXT` column from Migration v1 in `app/src/main/store/db.ts`. Since the app has not been released yet, direct schema modification is clean and preferred over adding a new migration step.

- **Stale Type Omits in IPC Handlers**:
  - **Symptom**: The IPC goals and tasks handler files (`app/src/main/ipc/goals.ts` and `app/src/main/ipc/tasks.ts`) omit `calendar_event_id` in type declarations (e.g. `Omit<Task, ... | 'calendar_event_id'>`). This is a code smell because the field doesn't exist on the `Task` type itself.
  - **Action**: Remove `'calendar_event_id'` from all `Omit` type assertions in `app/src/main/ipc/goals.ts` and `app/src/main/ipc/tasks.ts`.

- **Leftover local `server/` folder**:
  - **Symptom**: The Plover server was moved to a standalone repository (`plover-server`). The local `server/` directory in this monorepo only contains a `.env` file with a hardcoded `GEMINI_API_KEY` and configuration options.
  - **Action**: Delete the `server/` folder entirely.

## 2. Documentation and Configuration Drift

- **`AGENTS.md` and `CLAUDE.md` workspace references**:
  - **Symptom**: Both `AGENTS.md` and `CLAUDE.md` mention that Plover is a pnpm workspace with two packages: `app` and `server`. However, `pnpm-workspace.yaml` and the root `package.json` only list `app/`.
  - **Action**: Update `AGENTS.md` and `CLAUDE.md` to remove references to the `server/` package, its build commands, and local directory structures.

## 3. Future Code Quality Improvements (smells to watch for)

- **Relative Imports vs Path Aliases**:
  - Main process and renderer code mix relative imports (e.g., `../../shared/types.js`) with path aliases. While `.js` extensions are required by Vite/Node ESM resolution, using aliases consistently where supported can improve readability.
  - **Action**: Keep the path aliases defined in `tsconfig.json` up to date and verify that new files use `@main/` or `@shared/` when importing across modules.

- **Warning about React state updates in tests**:
  - **Symptom**: Running tests shows a React warning in `useCompanionState.test.ts`:
    `Warning: An update to TestComponent inside a test was not wrapped in act(...).`
  - **Action**: Wrap the state updates/fires in `useCompanionState.test.ts` inside `act(...)` from React Testing Library.

## 4. Long-Term & Broad-Scoped Codebase Improvement Goals

These are long-term, structural improvements recommended for the Plover team to address architectural risks, improve performance, and enhance developer experience:

- **Strict Migration & DB Schema Policy**:
  - **Problem**: Directly changing `Migration v1` is safe during early development, but once the product is distributed or in staging, modifying existing migrations will break existing local databases due to checksum/version mismatches.
  - **Goal**: Establish a policy where any schema changes (e.g. dropping columns, renaming tables) must be implemented via incremental migration scripts (e.g. Migration v3, v4). For local development, write a quick reset/seed command to rebuild a fresh database when needed.

- **End-to-End Type Safety for Electron Preload APIs**:
  - **Problem**: Electron's `ipcRenderer` and `ipcMain` channels communicate via string names and loose types. This can cause runtime errors if the main process updates a handler signature but the renderer continues calling it with old arguments.
  - **Goal**: Declare a strict typescript interface mapping channel names to their request/response schemas. Wrap `window.api` calls in a type-safe generic client that automatically enforces type-checking on both sides of the Electron bridge.

- **SQLite Database Optimization & Retention Management**:
  - **Problem**: In Phase 2, features like screenshot capture and background activity monitoring will log a high volume of rows to the `activity` table. Without proactive retention control, the database will swell in size and slow down index queries (FTS5).
  - **Goal**: Implement automatic daily maintenance triggers in SQLite (e.g., auto-vacuuming, indexing optimization) and design a strict background worker to delete old/expired logs according to settings.

- **Cross-Window State Synchronization**:
  - **Problem**: The desktop app runs multiple `BrowserWindow` instances (the main dashboard, the overlay quick-add window, etc.). React state is currently managed independently per window, which can cause task lists or status indications to become out of sync.
  - **Goal**: Implement a centralized state broadcast architecture where the Electron main process acts as the single source of truth, broadcasting state updates to all open renderer windows using IPC events.

- **Error Boundaries & Graceful Recovery**:
  - **Problem**: Local desktop environments are highly unpredictable. Network disconnects, disk permission denials, or Google OAuth token expiration could cause the app to crash or hang silently.
  - **Goal**: Integrate global error boundaries in React, log unhandled main-process rejections to local files, and implement a user-friendly recovery UI that suggests resetting OAuth or restarting the app.
