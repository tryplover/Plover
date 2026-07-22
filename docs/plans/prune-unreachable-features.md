# Prune Unreachable Features

Delete shipping-but-unreachable code across `app/src/main`, `app/src/preload`, and
`app/src/renderer`. A codebase scan surfaced 12 categories of dead code — all
verified against `main` at commit `23c6459` with grep evidence (zero non-test
callers). This plan is deletion only; no behavior changes for the live UI paths.

## Context (must-read before any edit)

- The **only** live overlay hotkey is `Option+Space` / `Alt+Shift+Space` (see
  `main/index.ts:224`). It calls `toggleOverlayWindow()` which calls
  `createOverlayWindow('overlay')`. Do not touch that path.
- `startSignup()` in `auth/signup-flow.ts` **is live** — called from
  `auth/with-auth-retry.ts:9`. Keep the function. Only the `signup:start` IPC
  wrapper around it is dead.
- `completeSignup()` in `auth/signup-flow.ts` **is live** — called from
  `main/index.ts:36` via `handleProtocolUrl` on the `plover://` protocol
  callback. Keep it. Only the `signup:complete` IPC wrapper is dead.
- `folderWatcher.watch(settings.watchedFolders)` on startup
  (`main/index.ts:177`) is live. Only the IPC path that lets the renderer
  *change* watched folders is dead.
- `decomposeGoal()` from `planner/decompose.ts` **is live** — called from the
  `goal:propose` handler at `ipc.ts:346`. Keep it. Only the `goals:decompose`
  IPC wrapper is dead.
- `saveGoalAndTasks()` from `planner/goal-manager.ts` **is live** — called from
  `goal:commit` at `ipc.ts:395`. Keep it. Only the `goals:save` IPC wrapper is
  dead.
- `scheduleTasks()` from `planner/schedule.ts` **is live** — called from
  `goal:propose` at `ipc.ts:365`. Keep it. Only the `tasks:schedule` IPC
  wrapper is dead.
- `listActiveWindows` and `WindowTracker` class both live in
  `activity/window-tracker.ts`. **Keep the class**; only the standalone
  exported `listActiveWindows` function is dead.
- The renderer only listens to the `app-event` broadcast channel (see
  `useAppEvents.ts`, `AIProgress.tsx`). The parallel per-event broadcasts
  (`goal:created`, `goal:updated`, etc.) in `goal-manager.ts` are dead.

## File-by-file changes

### 1. Delete companion feature entirely

**Delete files:**

- `app/src/main/windows/companion.ts`
- `app/src/renderer/companion/` (whole directory: `Collapsed.css`,
  `Collapsed.tsx`, `Companion.tsx`, `Expanded.css`, `Expanded.tsx`,
  `index.html`, `main.tsx`, `useCompanionState.ts`)
- `app/tests/renderer/companion/` (whole directory:
  `Companion.test.tsx`, `useCompanionState.test.ts`)

**Edit `app/src/main/ipc.ts`:**

- Remove `import { createCompanionWindow } from './windows/companion.js';`
  (line 14).
- Delete the entire `// Companion` block: the `companion`, `companionKind`,
  `companionActiveTaskId` variables, `ensureCompanion()`, and all
  `companion:*` handlers (lines ~446–485).

**Edit `app/src/preload/index.ts`:**

- Delete `export type StateKind = ...` (line 15).
- Delete `export interface CompanionApi { ... }` (lines 17–24).
- Remove `companion: CompanionApi;` field from `PloverApi` (line 164) and its
  section comment (line 163).
- Delete the `companion: { ... }` implementation block (lines 235–243) and
  its `// Companion` comment.

**Edit `app/electron.vite.config.ts`:**

- Remove the `companion: resolve('src/renderer/companion/index.html'),` line
  from `renderer.build.rollupOptions.input`. Leave only the `index` entry.

**If `app/src/main/windows/` becomes empty**, delete the directory too.

### 2. Delete signup UI path

The `SignupScreen` component and its IPC surface are unreachable — nothing
opens a window with `?variant=signup`. Auth uses the `plover://` protocol
callback which flows through `completeSignup(url)` directly.

**Delete files:**

- `app/src/renderer/setup/SignupScreen.tsx`
- `app/src/renderer/setup/SignupScreen.css`
- Any tests under `app/tests/renderer/setup/` that target `SignupScreen`.
  (Check for `SignupScreen.test.tsx` etc. and delete if present.)

**Edit `app/src/renderer/main.tsx`:**

- Remove `import { SignupScreen } from './setup/SignupScreen';`.
- Remove the `isSignup` computation and simplify the render:

  ```tsx
  createRoot(container).render(
    <StrictMode>{isOverlay ? <Overlay /> : <App />}</StrictMode>,
  );
  ```

**Edit `app/src/main/index.ts`:**

- Delete the `ipcMain.handle('signup:complete', ...)` handler at lines 209–218
  (the block that closes windows containing `variant=signup` and re-creates
  the main window). It has no live caller.
- Do NOT touch `handleProtocolUrl` or `completeSignup(url)`.

**Edit `app/src/main/ipc.ts`:**

- Remove `import { startSignup } from './auth/signup-flow.js';` (line 22).
  `startSignup` is still exported from `auth/signup-flow.ts` (used by
  `with-auth-retry.ts`) — just don't import it here.
- Delete the `ipcMain.handle('signup:start', ...)` handler at lines 152–154.

**Edit `app/src/preload/index.ts`:**

- Remove `signup: { start: ...; complete: ...; };` from the `PloverApi`
  interface (lines 172–176) and its `// Signup API` comment.
- Delete the `signup: { start: ..., complete: ... }` implementation block
  (lines 245–249) and its `// Signup` comment.

### 3. Delete `openSetupWindow` / `overlay:openWindow` / setup-window branch

`variant='window'` support in `createOverlayWindow` has no live caller. The
`overlay:openWindow` IPC + `openSetupWindow` preload wrapper are dead.

**Edit `app/src/main/ipc.ts`:**

- Delete the `setupWindow` closure variable and the
  `ipcMain.handle('overlay:openWindow', ...)` block (lines 430–444).
- Change the `setupIpcHandlers` and `setupIpc` signatures to drop the
  `createOverlayWindow?: ...` third parameter (line 53 and line 535).
- Remove the `createOverlayWindow` argument forwarding (line 537).

**Edit `app/src/main/index.ts`:**

- In the `setupIpc(...)` call at lines 196–204, remove the third argument
  `(variant) => createOverlayWindow(variant)`.
- Simplify `createOverlayWindow` (lines 101–148) to have **no `variant`
  parameter**: rename to `createOverlayWindow(): BrowserWindow` and delete
  the entire `isWindow` branching. The remaining function should be the
  overlay-shaped window (`width: 560, height: 480, frame: false,
  transparent: true, alwaysOnTop: true, skipTaskbar: true, resizable: false,
  vibrancy: 'under-window'`). Load URL with `search: 'variant=overlay'`
  unchanged (or drop the search entirely; `main.tsx` will fall through to
  `<App />` if variant is missing, which would break the overlay renderer —
  KEEP `variant=overlay` in the URL).
- Update `toggleOverlayWindow` to call `createOverlayWindow()` (no argument).
- Update the `overlayWindow = createOverlayWindow('overlay')` line at 221
  to `createOverlayWindow()`.

**Edit `app/src/preload/index.ts`:**

- Remove `openSetupWindow: () => Promise<void>;` from the `PloverApi`
  interface (line 151).
- Remove the `openSetupWindow: () => ipcRenderer.invoke(...)` line from the
  implementation (line 225).

**Edit `app/src/renderer/main.tsx`:**

- The `variant === 'window'` case is now unreachable. Simplify `isOverlay`
  to just `variant === 'overlay' || window.location.search.includes('overlay') || window.location.hash.includes('overlay')`.

**Edit `app/src/renderer/global.d.ts`:**

- Nothing here declares `openSetupWindow` explicitly. Skip (this file will
  be substantially edited in step 6).

### 4. Delete `listActiveWindows` IPC + standalone function

**Edit `app/src/main/ipc.ts`:**

- Remove `import { listActiveWindows } from './activity/window-tracker.js';`
  (line 15).
- Delete the `ipcMain.handle('windows:list', ...)` block (lines 487–494).

**Edit `app/src/preload/index.ts`:**

- Remove `listActiveWindows: () => Promise<{ app: string; title: string }[]>;`
  from `PloverApi` (line 152).
- Remove the corresponding implementation line (line 226).

**Edit `app/src/main/activity/window-tracker.ts`:**

- Delete the standalone `export function listActiveWindows(...)` (around
  line 123). Keep the `WindowTracker` class untouched.

**Edit `app/src/renderer/global.d.ts`:**

- Remove `listActiveWindows(): Promise<...>` (line 110).

### 5. Delete `overlay:set-ignore-mouse-events` and `overlay:set-tracking`

**Edit `app/src/main/ipc.ts`:**

- Delete both `ipcMain.handle('overlay:set-ignore-mouse-events', ...)` and
  `ipcMain.handle('overlay:set-tracking', ...)` blocks (lines 496–508).

**Edit `app/src/preload/index.ts`:**

- Remove `setIgnoreMouseEvents` and `setTrackingState` from `PloverApi`
  (lines 153–154).
- Remove their implementation lines (lines 227–228).

**Edit `app/src/renderer/global.d.ts`:**

- Remove both declarations (lines 111–112).

### 6. Delete `window:minimize` / `window:maximize` / `window:close`

**Edit `app/src/main/ipc.ts`:**

- Delete all three `ipcMain.handle('window:...', ...)` blocks (lines 516–529).

**Edit `app/src/preload/index.ts`:**

- Remove `minimizeWindow`, `maximizeWindow`, `closeWindow` from `PloverApi`
  (lines 168–170). Keep `platform: string;` (line 167) — that IS used.
- Remove their implementation lines (lines 262–264). Keep
  `platform: process.platform,` (line 261).

**Edit `app/src/renderer/global.d.ts`:**

- Remove all three declarations (lines 138–140).

### 7. Delete `tasks:schedule` / `goals:save` IPC + preload wrappers

**Edit `app/src/main/ipc.ts`:**

- Delete the `ipcMain.handle('tasks:schedule', ...)` block (lines 230–273).
- Delete the `ipcMain.handle('goals:save', ...)` block (lines 275–295).
- After these deletions, the `scheduleTasks` import at line 5 is still used
  by `goal:propose`. Keep it. `saveGoalAndTasks` at line 7 is still used by
  `goal:commit`. Keep it.

**Edit `app/src/preload/index.ts`:**

- Remove `scheduleTasks: ...` from `PloverApi` (lines 62–77).
- Remove `saveGoalAndTasks: ...` from `PloverApi` (lines 78–92).
- Remove their implementation lines (lines 211–214).

**Edit `app/src/renderer/global.d.ts`:**

- Remove `scheduleTasks` and `saveGoalAndTasks` declarations.

### 8. Delete `goals:decompose` IPC + preload wrapper

**Edit `app/src/main/ipc.ts`:**

- Delete the `ipcMain.handle('goals:decompose', ...)` block (lines 139–150).
- Keep the `decomposeGoal` import at line 4 — still used by `goal:propose`.

**Edit `app/src/preload/index.ts`:**

- Remove `decomposeGoal: ...` from `PloverApi` (lines 48–61).
- Remove `decomposeGoal: (goalText) => ipcRenderer.invoke(...)` (line 210).

**Edit `app/src/renderer/global.d.ts`:**

- Remove `decomposeGoal` declaration.

### 9. Delete `goals:create` / `goals:update` IPC handlers

Neither has a preload wrapper — nothing invokes them.

**Edit `app/src/main/ipc.ts`:**

- Delete both `ipcMain.handle('goals:create', ...)` and
  `ipcMain.handle('goals:update', ...)` blocks (lines 65–78).

### 10. Delete `settings:watched-folders:get` / `:set` + onWatchedFoldersChange

**Edit `app/src/main/ipc.ts`:**

- Delete both `ipcMain.handle('settings:watched-folders:...', ...)` blocks
  (lines 307–318).
- Drop the `onWatchedFoldersChange` parameter from `setupIpcHandlers` and
  `setupIpc` signatures.
- Remove the forwarding at `setupIpc`.

**Edit `app/src/main/index.ts`:**

- Simplify the `setupIpc(...)` call at lines 196–204: pass only
  `() => overlayWindow`. Drop the `async (folders: string[]) => { ... }`
  argument entirely (no live caller). The startup-time
  `folderWatcher.watch(settings.watchedFolders)` at line 177 stays — folder
  watching still initializes from settings; it just can't be changed at
  runtime from the (currently non-existent) UI.

### 11. Delete redundant per-event broadcasts in goal-manager

**Edit `app/src/main/planner/goal-manager.ts`:**

- In `startEventForwarding`, remove the first `broadcast(...)` call inside
  each subscription (lines 89, 94, 99, 104, 116, 121). Keep only the
  `broadcast('app-event', ...)` call. Example:

  ```ts
  eventBus.on('goal.created', (goal: Goal) => {
    broadcast('app-event', { type: 'goal.created', payload: { goalId: goal.id } });
  });
  ```

### 12. Delete `deviationLoopDispose`

**Edit `app/src/main/index.ts`:**

- Delete `let deviationLoopDispose: (() => void) | null = null;` (line 50).
- Delete the `if (deviationLoopDispose) { ... }` block inside `before-quit`
  (lines 257–260).

## Cleanup pass — always do at the end

- Run `grep -rn "SignupScreen\|createCompanionWindow\|CompanionApi\|StateKind\|companion:\|signup:start\|signup:complete\|openSetupWindow\|listActiveWindows\|setIgnoreMouseEvents\|setTrackingState\|minimizeWindow\|maximizeWindow\|closeWindow\|scheduleTasks\|saveGoalAndTasks\|decomposeGoal\|goals:create\|goals:update\|settings:watched-folders\|deviationLoopDispose\|onWatchedFoldersChange" app/src app/tests` — every hit outside preserved live paths (`startSignup`/`completeSignup` in `auth/`, `decomposeGoal`/`saveGoalAndTasks`/`scheduleTasks` in `planner/`, `platform` field) means something was missed.
- If `app/src/main/windows/` ends up empty after companion.ts deletion, delete the directory.

## Verification

From repo root:

```
pnpm typecheck && pnpm lint && pnpm test
```

Expected outcome: green. If tests fail with references to deleted symbols,
delete those tests too — they were coverage for dead code.

## Out of scope (do NOT touch)

- The overlay hotkey path and `Overlay.tsx` / `SetupFlow.tsx` renderer.
- Auth (`supabase-auth`, `signInWithPassword`, etc.) — all live.
- `WindowTracker` class in `activity/window-tracker.ts`.
- Google Docs sync (`sync/gdocs-poller.ts`) and activity monitors.
- `docs/superpowers/specs/` — those are product spec, not dead code.
