# Main and renderer reorganization — design

Structural refactor of `app/src/main/` and `app/src/renderer/` for
discoverability and modularity. Behavior is unchanged. Every commit in the
resulting stack ends green under `pnpm typecheck && pnpm lint && pnpm test`.

Base branch: `chore/prune-shipped-plans` (stacks on top of the recent doc
cleanup). All work happens in a git worktree at `/Users/liyu.xiao/Documents/GitHub/plover-refactor`
so it never contends with parallel Claude sessions running in the primary
checkout.

## Goals

1. Split `ipc.ts` (currently ~475 lines) into per-domain handler modules so
   each domain owns its IPC surface, wired centrally.
2. Move `bus.ts` under an `events/` subfolder so root of `src/main/` isn't a
   dumping ground for cross-cutting infrastructure.
3. Deduplicate the three copies of "resolve env from Vite-baked value or
   process.env with a dev fallback" (in `signup-flow.ts`, `supabase-client.ts`,
   `http/authed-fetch.ts`).
4. Deduplicate the two `getBackendUrl()` wrappers into a shared helper.
5. Co-locate every renderer component's files (`.tsx`, `.css`, `.test.tsx`)
   into a per-component folder. No barrels. Same-name files.

## Non-goals

- No behavior changes. Zero runtime-visible diffs.
- No new abstractions beyond the specific deduplications listed above (no
  event-bus wrapper, no repo base class, no error-handling wrapper).
- No barrel `index.ts` files in existing subdirs.
- No test relocation for `src/main/` — main-process tests stay under
  `app/tests/` because they don't have a 1:1 file-ownership relationship with
  a single source file.
- No changes to `hooks/`, `lib/`, `dev/`, `companion/`, `setup/`,
  `main/icons/` in the renderer — these aren't per-component and stay flat.
- No renaming files, only moving. `Button.tsx` stays `Button.tsx`; it just
  lives inside `components/Button/`.

## Target layout — `app/src/main/`

```
main/
├── index.ts             # bootstrap only, no logic changes
├── load-env.ts          # unchanged, must load before other imports
├── env.d.ts             # unchanged, ambient types
├── events/
│   └── bus.ts           # was ./bus.ts
├── ipc/
│   ├── index.ts         # thin registrar: registerAll(ipcMain)
│   ├── goals.ts         # goals:* handlers
│   ├── tasks.ts         # tasks:* handlers
│   ├── activity.ts      # activity:* handlers
│   ├── auth.ts          # auth:* handlers
│   ├── permissions.ts   # permissions:* handlers
│   ├── sync.ts          # sync:* handlers
│   └── system.ts        # companion, quit, misc
├── config/env.ts        # + resolveViteOrEnv() helper
├── http/
│   ├── authed-fetch.ts  # uses shared getBackendUrl()
│   └── backend-url.ts   # NEW: shared getBackendUrl()
├── activity/            # unchanged
├── auth/                # signup-flow.ts + supabase-client.ts stop
│                         # copy-pasting env resolution
├── lifecycle/           # unchanged
├── permissions/         # unchanged
├── planner/             # unchanged
├── store/               # unchanged
├── sync/                # unchanged
└── windows/             # unchanged
```

## Target layout — `app/src/renderer/`

```
renderer/
├── App.tsx, main.tsx                # entry points, stay flat
├── index.css, index.html, global.d.ts
├── plover-logo.png, Plover-Demo.mp4
├── components/
│   ├── AppRow/
│   │   ├── AppRow.tsx
│   │   ├── AppRow.css
│   │   └── AppRow.test.tsx           # from app/tests/renderer/components/
│   ├── Button/       (same shape)
│   ├── Chip/
│   ├── ProgressLine/
│   ├── StatusIndicator/
│   └── StepRow/
├── main/
│   ├── pages/
│   │   ├── AIProgress/AIProgress.tsx
│   │   ├── GoalsList/{GoalsList.tsx, GoalsList.test.tsx}
│   │   ├── Onboarding/{Onboarding.tsx, Onboarding.css, Onboarding.test.tsx}
│   │   └── Settings/Settings.tsx
│   └── icons/                        # unchanged
├── overlay/
│   ├── Overlay.tsx                   # unchanged, single-file component
│   ├── SetupFlow/
│   │   ├── SetupFlow.tsx
│   │   └── SetupFlow.css
│   └── steps/
│       ├── StepBreakdown/{StepBreakdown.tsx, StepBreakdown.css, StepBreakdown.test.tsx}
│       ├── StepName/{StepName.tsx, StepName.css}
│       └── Stepper/{Stepper.tsx, Stepper.css}
├── companion/, dev/, hooks/, lib/, setup/    # unchanged
```

Import shape after the move:

```ts
import { Button } from './components/Button/Button';
import { StepBreakdown } from './overlay/steps/StepBreakdown/StepBreakdown';
```

Vitest already discovers `src/**/*.test.tsx`, so no config change is needed
for colocated renderer tests.

## DRY changes

### A. Env resolution helper

`config/env.ts` gains a second export beside the existing
`resolveRequiredEnv`:

```ts
export function resolveViteOrEnv(
  name: string,
  { devFallback }: { devFallback: string },
): string {
  try {
    const fromVite = (import.meta as unknown as {
      env?: Record<string, string | undefined>;
    }).env?.[name];
    if (fromVite) return fromVite;
  } catch {
    // import.meta.env is undefined outside the Vite-built bundle
  }
  return resolveRequiredEnv(name, { devFallback });
}
```

Three call sites collapse to one-liners:

- `app/src/main/auth/signup-flow.ts` — `getBackendUrl()` becomes a call
  through `http/backend-url.ts` (see B).
- `app/src/main/auth/supabase-client.ts` — `resolveEnv('SUPABASE_URL', …)`
  and `resolveEnv('SUPABASE_ANON_KEY', …)` become
  `resolveViteOrEnv('SUPABASE_URL', {devFallback: ''})` etc.
- `app/src/main/http/authed-fetch.ts` — `getBackendUrl()` becomes a call
  through `http/backend-url.ts`.

### B. Shared `getBackendUrl()`

New file `app/src/main/http/backend-url.ts`:

```ts
import { resolveViteOrEnv } from '../config/env.js';

export function getBackendUrl(): string {
  return resolveViteOrEnv('PLOVER_BACKEND_URL', {
    devFallback: 'http://localhost:3000',
  });
}
```

Both `signup-flow.ts` and `authed-fetch.ts` import from this file. The two
local copies of `getBackendUrl()` are deleted.

### C. `ipc.ts` split

The current `ipc.ts` has ~48 `ipcMain.handle` calls. They are grouped by the
`domain:action` prefix of the channel name (`goals:decompose`,
`tasks:list`, `auth:signIn`, etc.). Each group moves into
`ipc/<domain>.ts`, exporting one function:

```ts
// ipc/goals.ts
export function registerGoalsHandlers(ipcMain: IpcMain): void {
  ipcMain.handle('goals:decompose', ...);
  ipcMain.handle('goals:commit', ...);
  // ...
}
```

`ipc/index.ts` wires everything:

```ts
export function setupIpcHandlers(): void {
  registerGoalsHandlers(ipcMain);
  registerTasksHandlers(ipcMain);
  registerActivityHandlers(ipcMain);
  registerAuthHandlers(ipcMain);
  registerPermissionsHandlers(ipcMain);
  registerSyncHandlers(ipcMain);
  registerSystemHandlers(ipcMain);
  // + any restore-session side effects that used to run at the top
}
```

Registration order is preserved from the original `ipc.ts` to avoid subtle
ordering-dependent behavior in tests. `app/src/main/index.ts` still calls
`setupIpcHandlers()` once at boot.

## Migration order

Each step is a single commit. Each commit ends green
(`pnpm typecheck && pnpm lint && pnpm test`). Each commit is delegated to a
Haiku subagent per the plan-then-delegate workflow.

1. `chore(main): move bus.ts → events/bus.ts` — one file move, update imports.
2. `refactor(main): consolidate env resolution in config/env.ts` — DRY A + B.
3. `refactor(main): split ipc.ts into ipc/{goals,tasks,activity,auth,permissions,sync,system}.ts` — the biggest single commit; test imports updated in the same commit.
4. `refactor(renderer): co-locate components into per-component folders` — `components/` tree only, tests moved from `app/tests/renderer/components/`.
5. `refactor(renderer): co-locate main/pages into per-page folders` — `main/pages/` tree, tests moved from `app/tests/renderer/main/pages/`.
6. `refactor(renderer): co-locate overlay components (SetupFlow + steps/*) into per-component folders` — `overlay/` and `overlay/steps/` trees, tests moved.
7. `chore(tests): remove empty test-mirror directories` — cleanup pass.

Each commit becomes its own PR in a Graphite stack.

## Risk register

| Risk | Mitigation |
|---|---|
| ipc.ts split changes handler registration order in a subtle way | Preserve the original order 1:1 in `ipc/index.ts`. |
| CSS import path breakage isn't caught by typecheck | Run `pnpm dev` once per renderer commit and confirm the app boots without runtime import errors. |
| Circular imports when splitting ipc.ts | Each `ipc/<domain>.ts` imports only from its domain module + shared types. `ipc/index.ts` is the only file importing all domains. |
| Concurrent Claude sessions in primary checkout | All work happens in the `../plover-refactor` worktree. |
| Vitest fails to discover colocated `.test.tsx` | Already covered by `src/**/*.test.tsx` in vitest.config.ts. No change needed. |
| Path-alias drift after moves | `@main/*` and `@renderer/*` aliases exist (`tsconfig.json`, `vitest.config.ts`). Each move updates both `../foo` relative and `@main/foo` alias imports across `src/` and `tests/`. |

## Verification

After all seven commits land:

- `pnpm typecheck && pnpm lint && pnpm --filter ./app run test:coverage` — full green.
- `pnpm dev` boots the app; onboarding + goals + settings render with no
  console errors.
- Manual smoke: sign-in via Supabase, decompose one goal, toggle activity
  polling. All succeed.

## Related docs

- `CLAUDE.md` — plan-then-delegate workflow.
- `docs/superpowers/specs/phase-1/core-architecture.md` — module boundaries.
- `docs/superpowers/specs/2026-05-24-task-tracker-agent-product-spec.md` — product spec.
