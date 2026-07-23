# Restore the companion overlay (top-of-screen progress pill)

## Context

The companion overlay is a small always-on-top window that sits centered at
the top of the screen and shows the active task's progress. It was deleted
wholesale by `b1da262` ("chore(cleanup): remove unreachable features and dead
IPC surface (#259)", 2026-07-21 21:21) as "unreachable... no UI trigger, only
reachable via DevTools console."

42 minutes later, commit `1593c0d` (2026-07-21 22:03, on a different line of
history — `desktop-fixes` branch, not this one) actually **fixed** the
companion window (solved a black-box transparency bug and a dev/prod URL
mismatch) and wired up `ensureCompanion().show()` so it displays automatically
at launch. This fix is documented in this repo's own [CLAUDE.md](../../CLAUDE.md)
lessons-learned entries dated 2026-07-21 ("transparent BrowserWindow on
Windows can render solid black" and "companion window's dev-mode URL didn't
match its actual file path").

That fix never reached this branch (`ui-fixes`, based on `desktop-fixes-split`)
— the deletion from `b1da262` is the version that's here. Net effect: the
CLAUDE.md lessons describe a working feature that does not exist in the code
on this branch. This plan restores it, using the fixed version from `1593c0d`
as the source of truth (not the original pre-fix version, and not a blind
revert of `b1da262`, which also correctly removed several *other* unrelated
dead code paths that must stay removed).

**Scope discipline:** `b1da262` was a broad cleanup touching signup screens,
`overlay:openWindow`, several dead preload wrappers, etc. Only restore the
companion-specific pieces called out below. Do not resurrect anything else
`b1da262` removed.

## Verified current state (as of this plan)

- `app/src/main/windows/companion.ts` and all of `app/src/renderer/companion/`
  do not exist on this branch.
- `app/src/main/store/repos/settings.ts` already has `theme` and
  `companionMode` fields — do not touch this file, it's already correct.
- `app/src/renderer/global.d.ts` already has `theme`/`companionMode` in the
  settings shape but has **no** `companion` API surface.
- `app/src/preload/index.ts` has **no** `CompanionApi`/`StateKind` type and no
  `companion` field on `PloverApi` or the `api` object.
- `app/src/main/ipc.ts`'s `setupIpcHandlers`/`setupIpc` currently take a
  single `getOverlayWindow` param and return `void`.
- `app/src/main/index.ts` currently calls `setupIpc(() => overlayWindow)` and
  does not show any companion window.
- `app/electron.vite.config.ts`'s renderer `rollupOptions.input` only has
  `index`, missing the `companion` entry.

## Step 1 — Mechanically restore companion-exclusive files

These files don't exist on this branch at all, so there's no merge conflict —
pull the final, fixed content straight from commit `1593c0d` verbatim:

```sh
cd /d/GitHub/Plover
mkdir -p app/src/renderer/companion app/tests/renderer/companion

for f in \
  app/src/main/windows/companion.ts \
  app/src/renderer/companion/Collapsed.css \
  app/src/renderer/companion/Collapsed.tsx \
  app/src/renderer/companion/Companion.tsx \
  app/src/renderer/companion/Expanded.css \
  app/src/renderer/companion/Expanded.tsx \
  app/src/renderer/companion/useCompanionState.ts \
  app/src/renderer/companion/index.html \
  app/src/renderer/companion/main.tsx \
  app/tests/renderer/companion/Companion.test.tsx \
  app/tests/renderer/companion/useCompanionState.test.ts \
  ; do
  git show 1593c0d:"$f" > "$f" 2>/dev/null || git show b1da262^:"$f" > "$f"
done
```

`index.html`, `main.tsx`, and the two test files were not touched by `1593c0d`
(no companion-specific fix needed there), so they only exist at the
pre-deletion commit `b1da262^` (b1da262's parent) — the `||` fallback in the
loop handles that. Verify after running: `git status --short` should show all
11 files as new/untracked, and none should be empty.

## Step 2 — `app/src/main/windows/companion.ts`

Already fully restored by Step 1 with the fix applied (explicit
`backgroundColor: '#00000000'`, top-center position via `screen.getPrimaryDisplay().workArea`,
correct dev URL `${ELECTRON_RENDERER_URL}/companion/index.html`). No further
edits needed to this file.

## Step 3 — `app/electron.vite.config.ts`

In the renderer config's `build.rollupOptions.input` (currently just
`{ index: resolve('src/renderer/index.html') }` around line 61-64), add the
companion entry:

```ts
input: {
  index: resolve('src/renderer/index.html'),
  companion: resolve('src/renderer/companion/index.html'),
},
```

## Step 4 — `app/src/preload/index.ts`

Add, right after the `ProposedPlan` interface (around line 13, before
`export interface PloverApi`):

```ts
export type StateKind = 'observing' | 'paused' | 'done' | 'not-sure';

export interface CompanionApi {
  show: () => Promise<void>;
  hide: () => Promise<void>;
  setActiveTask: (taskId: string | null) => Promise<void>;
  setState: (kind: StateKind) => Promise<void>;
  resize: (height: number, width?: number) => Promise<void>;
  getInitialState: () => Promise<{ kind: StateKind; activeTaskId: string | null }>;
}
```

In `PloverApi`, add a field (near the other window/platform fields, e.g.
right after `platform: string;`):

```ts
  // Companion API
  companion: CompanionApi;
```

In the `api: PloverApi = { ... }` object implementation, add (near
`platform: process.platform,`):

```ts
  // Companion
  companion: {
    show: () => ipcRenderer.invoke('companion:show'),
    hide: () => ipcRenderer.invoke('companion:hide'),
    setActiveTask: (taskId) => ipcRenderer.invoke('companion:setActiveTask', taskId),
    setState: (kind) => ipcRenderer.invoke('companion:setState', kind),
    resize: (height, width) => ipcRenderer.invoke('companion:resize', height, width),
    getInitialState: () => ipcRenderer.invoke('companion:getInitialState'),
  },
```

Note the `resize` signature takes an optional `width` — this is the fixed
version from `1593c0d`, not the original single-arg version `b1da262` deleted.

## Step 5 — `app/src/renderer/global.d.ts`

This file independently re-declares the `window.api` shape for the renderer's
own tsconfig scope (it already duplicates `theme`/`companionMode` etc. rather
than importing from preload — match that existing convention). Add a
`companion` field to the `PloverAPI` interface, inlined the same way the rest
of the file inlines types (no import from preload):

```ts
  companion: {
    show(): Promise<void>;
    hide(): Promise<void>;
    setActiveTask(taskId: string | null): Promise<void>;
    setState(kind: 'observing' | 'paused' | 'done' | 'not-sure'): Promise<void>;
    resize(height: number, width?: number): Promise<void>;
    getInitialState(): Promise<{
      kind: 'observing' | 'paused' | 'done' | 'not-sure';
      activeTaskId: string | null;
    }>;
  };
```

Place it near `listActiveWindows(): ...` / `platform: string;` at the end of
the interface.

## Step 6 — `app/src/main/ipc.ts`

1. Add the import: `import { createCompanionWindow } from './windows/companion.js';`
   (alongside the other `./...js` imports near the top).

2. Change both function signatures from returning `void` to returning
   `() => BrowserWindow`:
   ```ts
   export function setupIpcHandlers(getOverlayWindow: () => BrowserWindow | null): () => BrowserWindow {
   ```
   ```ts
   export function setupIpc(getOverlayWindow: () => BrowserWindow | null): () => BrowserWindow {
   ```

3. Inside `setupIpcHandlers`, just before the closing brace (after the
   `permissions:screenRecording:openSettings` handler, i.e. right before line
   ~317 `}`), add:

   ```ts
   // Companion
   let companion: BrowserWindow | null = null;
   let companionKind = 'observing';
   let companionActiveTaskId: string | null = null;

   function ensureCompanion(): BrowserWindow {
     if (!companion || companion.isDestroyed()) {
       companion = createCompanionWindow();
       companion.on('closed', () => {
         companion = null;
       });
     }
     return companion;
   }

   ipcMain.handle('companion:show', () => {
     ensureCompanion().show();
   });
   ipcMain.handle('companion:hide', () => {
     companion?.hide();
   });
   ipcMain.handle('companion:resize', (_e, height: number, width?: number) => {
     const w = ensureCompanion();
     const bounds = w.getBounds();
     const nextHeight = Math.max(20, Math.min(640, Math.round(height)));
     const nextWidth =
       width !== undefined ? Math.max(100, Math.min(600, Math.round(width))) : bounds.width;

     if (width !== undefined && nextWidth !== bounds.width) {
       const { workArea } = screen.getPrimaryDisplay();
       const nextX = workArea.x + Math.round((workArea.width - nextWidth) / 2);
       w.setBounds({
         x: nextX,
         y: bounds.y,
         width: nextWidth,
         height: nextHeight,
       });
     } else {
       w.setBounds({
         x: bounds.x,
         y: bounds.y,
         width: bounds.width,
         height: nextHeight,
       });
     }
   });
   ipcMain.handle('companion:setActiveTask', (_e, taskId: string | null) => {
     companionActiveTaskId = taskId;
     ensureCompanion().webContents.send('companion:activeTask', taskId);
   });
   ipcMain.handle('companion:setState', (_e, kind: string) => {
     companionKind = kind;
     ensureCompanion().webContents.send('companion:state', kind);
   });
   ipcMain.handle('companion:getInitialState', () => ({
     kind: companionKind,
     activeTaskId: companionActiveTaskId,
   }));

   return ensureCompanion;
   ```

   This uses the fixed `companion:resize` from `1593c0d` (bounds-based,
   re-centers horizontally when width changes) rather than the original
   `setSize`-based version `b1da262` deleted.

4. Add `screen` to the `electron` import at the top of the file:
   ```ts
   import { ipcMain, BrowserWindow, screen } from 'electron';
   ```

5. Update `setupIpc` to propagate the return value:
   ```ts
   export function setupIpc(getOverlayWindow: () => BrowserWindow | null): () => BrowserWindow {
     const ensureCompanion = setupIpcHandlers(getOverlayWindow);
     startEventForwarding(broadcast);
     return ensureCompanion;
   }
   ```

## Step 7 — `app/src/main/index.ts`

Change:
```ts
    // Register all typed IPC handlers first
    setupIpc(() => overlayWindow);
```
to:
```ts
    // Register all typed IPC handlers first
    const ensureCompanion = setupIpc(() => overlayWindow);
```

And right after `overlayWindow = createOverlayWindow();` (a few lines down),
add:
```ts
    ensureCompanion().show();
```

Do **not** touch anything else in this file — `createOverlayWindow`'s
single-arg (no `variant`) signature and the removed `signup:complete`/
`overlay:openWindow` handlers are unrelated and correctly stay gone.

## Step 8 — Verify

From the repo root:
```sh
pnpm typecheck && pnpm lint && pnpm test
```

All three must pass clean. Pay particular attention to:
- `app/src/renderer/companion/*.tsx` type-checking against `window.api.companion`
  (this is what Step 5's `global.d.ts` edit and Step 4's `preload/index.ts`
  edit both exist to satisfy — if either is missing/wrong, this is where it
  surfaces).
- The two restored test files in `app/tests/renderer/companion/` running and
  passing as-is (they were written against the `b1da262^` companion API,
  which Steps 4-6 fully restore the shape of).

If `pnpm test` fails on the two companion test files specifically, don't
adjust the tests to work around a mismatch — it means one of the restored
IPC handler names, resize signature, or type shapes in Steps 4-6 was copied
incorrectly; fix the implementation to match.

## Non-goals (do not do these)

- Do not restore `signup:start`/`signup:complete` IPC, `SignupScreen`,
  `overlay:openWindow`, `windows:list`, `overlay:set-ignore-mouse-events`,
  `overlay:set-tracking`, `window:minimize/maximize/close`, or any of
  `goals:create/update/decompose`, `tasks:schedule`, `goals:save` — these
  were separately and correctly removed as dead code by `b1da262` and are
  out of scope for this fix.
- Do not touch `app/src/main/store/repos/settings.ts` — `theme` and
  `companionMode` already exist there.
- Do not add a `variant: 'overlay' | 'window'` parameter back onto
  `createOverlayWindow` — unrelated to the companion window, out of scope.
