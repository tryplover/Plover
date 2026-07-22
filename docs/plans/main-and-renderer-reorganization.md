# Main and renderer reorganization implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reorganize `app/src/main/` and `app/src/renderer/` for discoverability and modularity without changing behavior. Ship as a 7-commit Graphite stack, each PR independently reviewable and green.

**Architecture:** File moves + import-path updates + one new helper (`resolveViteOrEnv`) + one thin registrar (`ipc/index.ts`). No new abstractions, no barrels, no test-runner config changes.

**Tech Stack:** TypeScript, Electron, Vite, Vitest, pnpm workspaces. Path aliases: `@main/*` → `app/src/main/*`, `@renderer/*` → `app/src/renderer/*`.

## Global Constraints

- Working directory for all commands: `/Users/liyu.xiao/Documents/GitHub/plover-refactor` (git worktree on branch `chore/prune-shipped-plans`). Never touch the primary checkout at `/Users/liyu.xiao/Documents/GitHub/BuildWithGeminiHackathon`.
- Every commit must **not introduce new test failures** relative to the previous commit. Baseline (`0756781`): 20 test files failed, 89 tests failed, 194 passed. Any commit above that baseline must show ≤ these numbers under `PATH=~/Library/pnpm:$PATH pnpm --filter ./app run test`. Typecheck and lint must be fully green: `PATH=~/Library/pnpm:$PATH pnpm --filter ./app run typecheck && PATH=~/Library/pnpm:$PATH pnpm --filter ./app run lint`. The pre-existing 89-test debt is out of scope for this refactor.
- Use `PATH=~/Library/pnpm:$PATH` in front of every `pnpm` call (this machine's pnpm lives at `~/Library/pnpm/pnpm`, not on default PATH). See `CLAUDE.md` lesson-learned.
- Zero behavior changes. If any diff changes runtime behavior, revert that hunk.
- Preserve `.js` extensions in relative imports (this repo is `"type": "module"` — ESM requires the extension).
- Preserve exact `ipcMain.handle` registration order when splitting `ipc.ts`.
- No barrel `index.ts` files in any existing subdirectory (only the new `ipc/index.ts` counts, and it's a registrar not a barrel).
- Same-name files inside per-component folders (`Button/Button.tsx`, never `Button/index.tsx`).
- Every commit message includes trailer `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>`.
- After each commit, run `gt track` (Graphite) so the commit stack is set up correctly. If Graphite isn't in use in this repo, skip and note in the task's follow-ups.

---

## Task 1: Move `bus.ts` → `events/bus.ts`

**Files:**
- Create: `app/src/main/events/bus.ts` (moved from `app/src/main/bus.ts`)
- Modify: 9 relative imports in `app/src/main/**` — the 9 files listed in Step 3.
- Modify: 6 alias imports in `app/tests/**` matching `@main/bus.js` → `@main/events/bus.js`.
- Modify: 2 relative test imports (`app/tests/bus.test.ts`, `app/tests/activity/gdocs-subscriber.test.ts`, `app/tests/sync/gdocs-poller.test.ts`) that use `../../src/main/bus` style.

**Interfaces:**
- Consumes: nothing.
- Produces: same exports (`TypedEventBus`, `eventBus`) at path `@main/events/bus.js` / `../events/bus.js` / `../../events/bus.js`. No signature changes.

- [ ] **Step 1: Move the file**

```bash
cd /Users/liyu.xiao/Documents/GitHub/plover-refactor
mkdir -p app/src/main/events
git mv app/src/main/bus.ts app/src/main/events/bus.ts
```

- [ ] **Step 2: Verify test suite fails (imports broken)**

```bash
PATH=~/Library/pnpm:$PATH pnpm --filter ./app run typecheck 2>&1 | head -20
```

Expected: many `Cannot find module '../bus.js'` errors. If typecheck passes, the source imports were not what the plan expected — stop and re-survey.

- [ ] **Step 3: Update relative imports in `app/src/main/`**

Update each of these files: replace `'../bus.js'` → `'../events/bus.js'`, and `'./bus.js'` → `'./events/bus.js'`.

```
app/src/main/activity/inference.ts        (line 6, '../bus.js' → '../events/bus.js')
app/src/main/activity/git-commit-tracker.ts (line 6, same)
app/src/main/activity/gdocs-subscriber.ts (line 3, same)
app/src/main/activity/index.ts            (line 7, same)
app/src/main/activity/folder-watcher.ts   (line 4, same)
app/src/main/planner/goal-manager.ts      (line 4, same)
app/src/main/sync/gdocs-poller.ts         (line 4, same)
app/src/main/ipc.ts                       (line 12, './bus.js' → './events/bus.js')
app/src/main/index.ts                     (line 10, './bus.js' → './events/bus.js')
```

- [ ] **Step 4: Update alias imports in `app/tests/`**

Every occurrence of `from '@main/bus.js'` in `app/tests/**` becomes `from '@main/events/bus.js'`. Find them with:

```bash
grep -rln "@main/bus" app/tests/
```

Update each match. Also update the two relative-path test files:
- `app/tests/bus.test.ts:2` — `'../src/main/bus.js'` → `'../src/main/events/bus.js'`
- `app/tests/activity/gdocs-subscriber.test.ts:6` — `'../../src/main/bus'` → `'../../src/main/events/bus'`
- `app/tests/sync/gdocs-poller.test.ts:8` — `'../../src/main/bus'` → `'../../src/main/events/bus'`

Also move the test file itself:

```bash
mkdir -p app/tests/events
git mv app/tests/bus.test.ts app/tests/events/bus.test.ts
```

Then in `app/tests/events/bus.test.ts` update its import path `../src/main/events/bus.js` → `../../src/main/events/bus.js` (deeper now).

- [ ] **Step 5: Run full verification**

```bash
PATH=~/Library/pnpm:$PATH pnpm --filter ./app run typecheck && \
  PATH=~/Library/pnpm:$PATH pnpm --filter ./app run lint && \
  PATH=~/Library/pnpm:$PATH pnpm --filter ./app run test
```

Expected: all three green.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
refactor(main): move bus.ts under events/ subfolder

Structural move only — no behavior change. Updates all relative and
@main/* alias imports plus the colocated test file.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 7: Graphite track (if in use)**

```bash
gt track 2>&1 || echo "Graphite not initialized here — skip"
```

---

## Task 2: Consolidate env resolution in `config/env.ts`

**Files:**
- Modify: `app/src/main/config/env.ts` — add `resolveViteOrEnv()` export.
- Create: `app/src/main/http/backend-url.ts` — shared `getBackendUrl()`.
- Modify: `app/src/main/http/authed-fetch.ts` — remove local `getBackendUrl()`; import from `./backend-url.js`.
- Modify: `app/src/main/auth/signup-flow.ts` — remove local `getBackendUrl()`; import from `../http/backend-url.js`.
- Modify: `app/src/main/auth/supabase-client.ts` — replace local `resolveEnv()` with `resolveViteOrEnv` from `../config/env.js`.
- Test: `app/tests/main/config/env.test.ts` (new) — cover the new helper.

**Interfaces:**
- Consumes: existing `resolveRequiredEnv(name, {devFallback}): string` from `@main/config/env.js`.
- Produces:
  - `export function resolveViteOrEnv(name: string, {devFallback}: {devFallback: string}): string` in `@main/config/env.js`.
  - `export function getBackendUrl(): string` in `@main/http/backend-url.js`.

- [ ] **Step 1: Write failing test for `resolveViteOrEnv`**

Create `app/tests/main/config/env.test.ts`:

```ts
import { describe, it, expect, afterEach } from 'vitest';
import { resolveViteOrEnv } from '@main/config/env.js';

describe('resolveViteOrEnv', () => {
  const originalEnv = process.env.SOME_TEST_VAR;

  afterEach(() => {
    if (originalEnv === undefined) delete process.env.SOME_TEST_VAR;
    else process.env.SOME_TEST_VAR = originalEnv;
  });

  it('returns process.env value when set (dev, no Vite bake)', () => {
    process.env.SOME_TEST_VAR = 'from-env';
    expect(resolveViteOrEnv('SOME_TEST_VAR', { devFallback: 'fallback' })).toBe('from-env');
  });

  it('returns devFallback when unset in dev', () => {
    delete process.env.SOME_TEST_VAR;
    expect(resolveViteOrEnv('SOME_TEST_VAR', { devFallback: 'fallback' })).toBe('fallback');
  });
});
```

- [ ] **Step 2: Verify it fails**

```bash
PATH=~/Library/pnpm:$PATH pnpm --filter ./app run test -- app/tests/main/config/env.test.ts 2>&1 | tail -15
```

Expected: FAIL — `resolveViteOrEnv is not a function` (only `resolveRequiredEnv` is exported today).

- [ ] **Step 3: Add `resolveViteOrEnv` to `app/src/main/config/env.ts`**

Append to the file (do not touch existing `resolveRequiredEnv`):

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
    // import.meta.env undefined outside Vite-built bundle
  }
  return resolveRequiredEnv(name, { devFallback });
}
```

- [ ] **Step 4: Verify the new test passes**

```bash
PATH=~/Library/pnpm:$PATH pnpm --filter ./app run test -- app/tests/main/config/env.test.ts 2>&1 | tail -10
```

Expected: PASS (both cases).

- [ ] **Step 5: Create `app/src/main/http/backend-url.ts`**

```ts
import { resolveViteOrEnv } from '../config/env.js';

export function getBackendUrl(): string {
  return resolveViteOrEnv('PLOVER_BACKEND_URL', {
    devFallback: 'http://localhost:3000',
  });
}
```

- [ ] **Step 6: Update `app/src/main/http/authed-fetch.ts`**

Delete the local `getBackendUrl()` function (lines 1–14 or wherever it lives). Replace with:

```ts
import { getBackendUrl } from './backend-url.js';
```

Leave the rest of the file unchanged.

- [ ] **Step 7: Update `app/src/main/auth/signup-flow.ts`**

Delete the local `getBackendUrl()` function (currently lines 17–26). Add:

```ts
import { getBackendUrl } from '../http/backend-url.js';
```

Replace all call sites of the local `getBackendUrl()` with the imported one (identical name — no code changes at call sites).

- [ ] **Step 8: Update `app/src/main/auth/supabase-client.ts`**

Replace the local `resolveEnv` function (currently lines 22–33 approximately) with a direct call to the shared helper. Change each call site:

```ts
// Before:
resolveEnv('SUPABASE_URL')

// After:
import { resolveViteOrEnv } from '../config/env.js';
// ...
resolveViteOrEnv('SUPABASE_URL', { devFallback: '' })
```

Two call sites: `SUPABASE_URL` and `SUPABASE_ANON_KEY`. Both use `devFallback: ''` (matches previous fall-through-to-empty-string behavior).

Delete the now-unused `resolveEnv` function.

- [ ] **Step 9: Verify no other callers of the deleted helpers**

```bash
grep -rn "resolveEnv\b" app/src/main/ app/tests/
grep -rn "function getBackendUrl" app/src/main/
```

Expected: only test-file references and the new shared helpers remain. Zero source-file duplicates.

- [ ] **Step 10: Full verification**

```bash
PATH=~/Library/pnpm:$PATH pnpm --filter ./app run typecheck && \
  PATH=~/Library/pnpm:$PATH pnpm --filter ./app run lint && \
  PATH=~/Library/pnpm:$PATH pnpm --filter ./app run test
```

Expected: all green.

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
refactor(main): consolidate env resolution in config/env.ts

Adds resolveViteOrEnv() to config/env.ts. Extracts shared getBackendUrl()
into http/backend-url.ts. Collapses three duplicated Vite-or-process.env
resolvers across signup-flow.ts, supabase-client.ts, and authed-fetch.ts.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
gt track 2>&1 || true
```

---

## Task 3: Split `ipc.ts` into per-domain handler modules

**Files:**
- Delete: `app/src/main/ipc.ts` (contents redistributed).
- Create: `app/src/main/ipc/index.ts` — thin registrar.
- Create: `app/src/main/ipc/goals.ts` — `goals:*` and `goal:*` channels.
- Create: `app/src/main/ipc/tasks.ts` — `tasks:*` channels.
- Create: `app/src/main/ipc/activity.ts` — `settings:watched-folders:*`, `summaries:*` (activity-adjacent), `permissions:*`.
- Create: `app/src/main/ipc/auth.ts` — `signup:start`, `auth:*`, `google:*`.
- Create: `app/src/main/ipc/settings.ts` — `settings:get`, `settings:update`.
- Create: `app/src/main/ipc/overlay.ts` — `overlay:*`, `companion:*`, `windows:list`.
- Create: `app/src/main/ipc/system.ts` — `window:minimize`, `window:maximize`, `window:close`.
- Modify: `app/src/main/index.ts` — import from `./ipc/index.js` instead of `./ipc.js`.
- Modify: `app/tests/main/ipc.test.ts` — update the import (still tests the same public function).

**Channel-to-file mapping** (preserve original registration order within each file, matched from `app/src/main/ipc.ts`):

```
ipc/goals.ts        goals:get, goals:create (multi-arg), goals:update, goals:delete,
                    goals:decompose, goal:propose, goal:commit
ipc/tasks.ts        tasks:get, tasks:getById, tasks:getByGoal, tasks:updateStatus
ipc/auth.ts         signup:start, auth:signIn, auth:signInWithPassword,
                    auth:signUp, auth:signOut, auth:getStatus,
                    google:connect, google:disconnect,
                    activity:tracking:enable, activity:tracking:disable
                    (the two activity-tracking handlers stay with auth if they
                    call into google-auth; if they call activity module,
                    move to ipc/activity.ts. Check the source at split time.)
ipc/settings.ts     settings:get, settings:update,
                    settings:watched-folders:get, settings:watched-folders:set,
                    summaries:get
ipc/overlay.ts      overlay:close, overlay:resize, overlay:openWindow,
                    overlay:set-ignore-mouse-events, overlay:set-tracking,
                    companion:show, companion:hide, companion:resize,
                    companion:setActiveTask, companion:setState,
                    companion:getInitialState, windows:list
ipc/system.ts       window:minimize, window:maximize, window:close,
                    permissions:screenRecording:status,
                    permissions:screenRecording:request,
                    permissions:screenRecording:openSettings
```

Two `ipcMain.handle` sites at lines 197 and 240 are multi-arg (goals-related without explicit `goals:` prefix in the grep — read those lines when splitting to confirm the channel name and place accordingly).

**Interfaces:**
- Consumes: same modules ipc.ts consumes today (`GoalsRepo`, `TasksRepo`, planner, activity, auth, sync, permissions, windows, event bus).
- Produces:
  - Each `ipc/<domain>.ts` exports one function: `export function register<Domain>Handlers(): void`.
  - `ipc/index.ts` exports `setupIpcHandlers(): void` — same public name as the original `ipc.ts` — that calls all `register<Domain>Handlers()` in the order shown above.

- [ ] **Step 1: Confirm the current public export shape**

```bash
grep -n "^export" app/src/main/ipc.ts
```

Expected output includes `export function setupIpcHandlers`. If the exported name differs, use that name in `ipc/index.ts` — do not rename.

- [ ] **Step 2: Enumerate handlers verbatim from `ipc.ts`**

```bash
grep -n "ipcMain\." app/src/main/ipc.ts
```

Copy the full output into a scratch buffer. This is your authoritative registration order — the new `ipc/index.ts` must call `register*Handlers` functions such that when concatenated, the handlers appear in this exact order.

- [ ] **Step 3: Create the ipc directory and empty files**

```bash
mkdir -p app/src/main/ipc
touch app/src/main/ipc/{index,goals,tasks,auth,settings,overlay,system}.ts
```

- [ ] **Step 4: For each domain file, extract handlers**

For each of the 7 domain files, produce a file of shape:

```ts
import { ipcMain } from 'electron';
// + whatever imports the moved handlers use (copy from ipc.ts)

export function register<Domain>Handlers(): void {
  ipcMain.handle('channel:name', async (...) => {
    // exact body copied verbatim from ipc.ts
  });
  // ...
}
```

Rules:
- Copy handler bodies verbatim, including whitespace, from `ipc.ts`.
- Copy only the imports that the moved handlers use. Do not eagerly copy the full ipc.ts import block into every file.
- If a helper function (e.g., `getRecentActivityContext`) is used by handlers in multiple domain files, move it into the domain file where its primary caller lives, and let the other domain file import it from there. If ambiguous, move to `ipc/shared.ts` (new file) — but only if actually needed.

- [ ] **Step 5: Wire everything in `ipc/index.ts`**

```ts
import { registerGoalsHandlers } from './goals.js';
import { registerTasksHandlers } from './tasks.js';
import { registerAuthHandlers } from './auth.js';
import { registerSettingsHandlers } from './settings.js';
import { registerOverlayHandlers } from './overlay.js';
import { registerSystemHandlers } from './system.js';

export function setupIpcHandlers(): void {
  // Order MUST match original ipc.ts. See docs/plans/... Step 2 scratch.
  registerGoalsHandlers();
  registerTasksHandlers();
  registerAuthHandlers();
  registerSettingsHandlers();
  registerOverlayHandlers();
  registerSystemHandlers();
}
```

If the original `ipc.ts` had non-handler side effects at the top of `setupIpcHandlers` (e.g. `void supabaseAuth.restoreSession().then(...)`), copy those into the new `ipc/index.ts` `setupIpcHandlers` body before the `register*Handlers()` calls.

- [ ] **Step 6: Delete `ipc.ts`**

```bash
git rm app/src/main/ipc.ts
```

- [ ] **Step 7: Update `app/src/main/index.ts`**

Change:

```ts
import { setupIpcHandlers } from './ipc.js';
```

To:

```ts
import { setupIpcHandlers } from './ipc/index.js';
```

- [ ] **Step 8: Update `app/tests/main/ipc.test.ts` and any other test importers**

```bash
grep -rn "'../src/main/ipc\b\|@main/ipc\b" app/tests/
```

For each match, update to `.../ipc/index.js` (or `@main/ipc/index.js`).

- [ ] **Step 9: Full verification**

```bash
PATH=~/Library/pnpm:$PATH pnpm --filter ./app run typecheck && \
  PATH=~/Library/pnpm:$PATH pnpm --filter ./app run lint && \
  PATH=~/Library/pnpm:$PATH pnpm --filter ./app run test
```

Expected: all green. Test count must match the pre-split count (no tests silently disabled).

If a test fails referencing a specific channel, that channel is registered in the wrong file — grep for the channel name across `ipc/*.ts` and confirm it appears exactly once.

- [ ] **Step 10: Smoke-run the app**

```bash
PATH=~/Library/pnpm:$PATH pnpm dev
```

Let it boot. Sign-in / decompose / settings should all render without console errors. Kill with Ctrl-C once verified.

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
refactor(main): split ipc.ts into per-domain handler modules

Splits ~475-line ipc.ts into ipc/{goals,tasks,auth,settings,overlay,system}.ts.
Root ipc/index.ts is a thin registrar that preserves original handler
registration order. Public export setupIpcHandlers() unchanged.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
gt track 2>&1 || true
```

---

## Task 4: Co-locate renderer `components/` into per-component folders

**Files (7 components × 2–3 files each):**

For each component in `app/src/renderer/components/` (AppRow, Button, Chip, ProgressLine, StatusIndicator, StepRow), move:

- `components/<Name>.tsx` → `components/<Name>/<Name>.tsx`
- `components/<Name>.css` → `components/<Name>/<Name>.css` (if it exists)
- `app/tests/renderer/components/<Name>.test.tsx` → `app/src/renderer/components/<Name>/<Name>.test.tsx`

**Interfaces:**
- Consumes: nothing new.
- Produces: same components at deeper paths. Import path change is the only externally-visible effect.

- [ ] **Step 1: Confirm the current component list**

```bash
ls app/src/renderer/components/
```

Expected: `AppRow.css AppRow.tsx Button.css Button.tsx Chip.css Chip.tsx ProgressLine.css ProgressLine.tsx StatusIndicator.css StatusIndicator.tsx StepRow.css StepRow.tsx`.

- [ ] **Step 2: For each component, move and update its CSS import**

Example for `Button`:

```bash
cd /Users/liyu.xiao/Documents/GitHub/plover-refactor
mkdir -p app/src/renderer/components/Button
git mv app/src/renderer/components/Button.tsx app/src/renderer/components/Button/Button.tsx
git mv app/src/renderer/components/Button.css app/src/renderer/components/Button/Button.css
git mv app/tests/renderer/components/Button.test.tsx app/src/renderer/components/Button/Button.test.tsx
```

Then in `app/src/renderer/components/Button/Button.tsx`, if there's an import like `import './Button.css'`, it stays unchanged (still relative and colocated).

If the CSS import used a leading path like `import '../components/Button.css'` from another file, that other file's import path needs updating — grep for it:

```bash
grep -rn "components/Button" app/src/ app/tests/
```

Update every match to `components/Button/Button` (either `.tsx` for source refs or `.css` for style refs).

Repeat for AppRow, Chip, ProgressLine, StatusIndicator, StepRow.

- [ ] **Step 3: Update the test file imports**

For each moved `<Name>.test.tsx`, if it previously imported the component via `import {<Name>} from '../../../src/renderer/components/<Name>'` or `@renderer/components/<Name>`, update to the new colocated path:

```ts
// Old (from app/tests/renderer/components/Button.test.tsx):
import { Button } from '../../../src/renderer/components/Button';

// New (colocated at app/src/renderer/components/Button/Button.test.tsx):
import { Button } from './Button';
```

Same for `@renderer/components/Button` → `@renderer/components/Button/Button`.

- [ ] **Step 4: Grep for stragglers**

```bash
grep -rn "components/AppRow\b\|components/Button\b\|components/Chip\b\|components/ProgressLine\b\|components/StatusIndicator\b\|components/StepRow\b" app/src/ app/tests/
```

Every match should end in `/<Name>/<Name>` now. Any bare `components/<Name>` (without the doubled name) is a stale import.

- [ ] **Step 5: Full verification**

```bash
PATH=~/Library/pnpm:$PATH pnpm --filter ./app run typecheck && \
  PATH=~/Library/pnpm:$PATH pnpm --filter ./app run lint && \
  PATH=~/Library/pnpm:$PATH pnpm --filter ./app run test
```

Expected: all green.

- [ ] **Step 6: Smoke-run the app**

```bash
PATH=~/Library/pnpm:$PATH pnpm dev
```

Open DevTools. No CSS 404s, no missing-module errors, no visual regressions on the pages that use these components (Onboarding, GoalsList, Settings, Overlay steps).

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
refactor(renderer): co-locate components into per-component folders

Each component in src/renderer/components/ now owns a folder with its
.tsx, .css, and .test.tsx. Tests move from app/tests/renderer/components/
to colocated positions. Vitest already discovers src/**/*.test.tsx.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
gt track 2>&1 || true
```

---

## Task 5: Co-locate renderer `main/pages/` into per-page folders

**Files:**

For each page in `app/src/renderer/main/pages/`:

- `main/pages/AIProgress.tsx` → `main/pages/AIProgress/AIProgress.tsx`
- `main/pages/GoalsList.tsx` → `main/pages/GoalsList/GoalsList.tsx`
- `main/pages/Onboarding.tsx` + `Onboarding.css` → `main/pages/Onboarding/Onboarding.tsx` + `Onboarding.css`
- `main/pages/Settings.tsx` → `main/pages/Settings/Settings.tsx`
- Tests move from `app/tests/renderer/main/pages/<Name>.test.tsx` to `main/pages/<Name>/<Name>.test.tsx`.

**Interfaces:**
- Same as Task 4 pattern.

- [ ] **Step 1: Move each page**

```bash
cd /Users/liyu.xiao/Documents/GitHub/plover-refactor
for P in AIProgress GoalsList Settings; do
  mkdir -p app/src/renderer/main/pages/$P
  git mv app/src/renderer/main/pages/$P.tsx app/src/renderer/main/pages/$P/$P.tsx
done

mkdir -p app/src/renderer/main/pages/Onboarding
git mv app/src/renderer/main/pages/Onboarding.tsx app/src/renderer/main/pages/Onboarding/Onboarding.tsx
git mv app/src/renderer/main/pages/Onboarding.css app/src/renderer/main/pages/Onboarding/Onboarding.css
```

- [ ] **Step 2: Move colocated tests**

```bash
git mv app/tests/renderer/main/pages/GoalsList.test.tsx app/src/renderer/main/pages/GoalsList/GoalsList.test.tsx
git mv app/tests/renderer/main/pages/Onboarding.test.tsx app/src/renderer/main/pages/Onboarding/Onboarding.test.tsx
git mv app/tests/renderer/main/pages/Settings.test.tsx app/src/renderer/main/pages/Settings/Settings.test.tsx
```

- [ ] **Step 3: Update imports across the app**

```bash
grep -rn "main/pages/AIProgress\b\|main/pages/GoalsList\b\|main/pages/Onboarding\b\|main/pages/Settings\b" app/src/ app/tests/
```

Every hit needs the doubled path. Common callers to update: `app/src/renderer/App.tsx`, `app/src/renderer/main/main.tsx` (if it exists), the moved test files themselves (their `../../../src/renderer/main/pages/<Name>` becomes `./<Name>`).

- [ ] **Step 4: Full verification**

```bash
PATH=~/Library/pnpm:$PATH pnpm --filter ./app run typecheck && \
  PATH=~/Library/pnpm:$PATH pnpm --filter ./app run lint && \
  PATH=~/Library/pnpm:$PATH pnpm --filter ./app run test
```

Expected: all green.

- [ ] **Step 5: Smoke-run the app**

```bash
PATH=~/Library/pnpm:$PATH pnpm dev
```

Navigate to each page: Onboarding, Goals, Settings, AIProgress (however AIProgress is reached — check `App.tsx` routing). Zero regressions.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
refactor(renderer): co-locate main/pages into per-page folders

Every page under src/renderer/main/pages/ now owns a folder with its .tsx,
.css (where applicable), and .test.tsx. Tests migrated from
app/tests/renderer/main/pages/.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
gt track 2>&1 || true
```

---

## Task 6: Co-locate `overlay/` components and `overlay/steps/`

**Files:**

- `overlay/SetupFlow.tsx` + `overlay/SetupFlow.css` → `overlay/SetupFlow/SetupFlow.tsx` + `SetupFlow.css`
- `overlay/Overlay.tsx` — stays flat (no CSS, no test in its own dir).
- Steps (StepBreakdown, StepName, Stepper): each `overlay/steps/<Name>.tsx` + `.css` → `overlay/steps/<Name>/<Name>.tsx` + `.css`.
- Tests from `app/tests/renderer/overlay/` move to their component folders:
  - `overlay/SetupFlow.test.tsx` → `app/src/renderer/overlay/SetupFlow/SetupFlow.test.tsx`
  - `overlay/steps/StepBreakdown.test.tsx` → `app/src/renderer/overlay/steps/StepBreakdown/StepBreakdown.test.tsx`
  - `overlay/steps/StepName.test.tsx` → `app/src/renderer/overlay/steps/StepName/StepName.test.tsx`
  - `overlay/steps/Stepper.test.tsx` → `app/src/renderer/overlay/steps/Stepper/Stepper.test.tsx`
- `overlay/steps/StepConnect.test.tsx` — orphan test (no matching source file); STAYS at `app/tests/renderer/overlay/steps/StepConnect.test.tsx`. Do not delete or move.

**Interfaces:**
- Same as prior tasks.

- [ ] **Step 1: Move SetupFlow**

```bash
mkdir -p app/src/renderer/overlay/SetupFlow
git mv app/src/renderer/overlay/SetupFlow.tsx app/src/renderer/overlay/SetupFlow/SetupFlow.tsx
git mv app/src/renderer/overlay/SetupFlow.css app/src/renderer/overlay/SetupFlow/SetupFlow.css
git mv app/tests/renderer/overlay/SetupFlow.test.tsx app/src/renderer/overlay/SetupFlow/SetupFlow.test.tsx
```

- [ ] **Step 2: Move each step**

```bash
for S in StepBreakdown StepName Stepper; do
  mkdir -p app/src/renderer/overlay/steps/$S
  git mv app/src/renderer/overlay/steps/$S.tsx app/src/renderer/overlay/steps/$S/$S.tsx
  git mv app/src/renderer/overlay/steps/$S.css app/src/renderer/overlay/steps/$S/$S.css
  git mv app/tests/renderer/overlay/steps/$S.test.tsx app/src/renderer/overlay/steps/$S/$S.test.tsx
done
```

- [ ] **Step 3: Update imports**

```bash
grep -rn "overlay/SetupFlow\b\|overlay/steps/StepBreakdown\b\|overlay/steps/StepName\b\|overlay/steps/Stepper\b" app/src/ app/tests/
```

Every match becomes the doubled path (`overlay/SetupFlow/SetupFlow`, etc.). Common consumers: `Overlay.tsx` (renders the steps), the moved test files' relative imports.

- [ ] **Step 4: Full verification**

```bash
PATH=~/Library/pnpm:$PATH pnpm --filter ./app run typecheck && \
  PATH=~/Library/pnpm:$PATH pnpm --filter ./app run lint && \
  PATH=~/Library/pnpm:$PATH pnpm --filter ./app run test
```

Expected: all green.

- [ ] **Step 5: Smoke-run the overlay**

```bash
PATH=~/Library/pnpm:$PATH pnpm dev
```

Trigger the overlay (however it's launched — global hotkey per phase-1 spec). Walk through StepName → StepBreakdown → completion. Zero regressions.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
refactor(renderer): co-locate overlay components into per-component folders

SetupFlow and each step under overlay/steps/ own their folders. Orphan
StepConnect.test.tsx (no matching source) stays at its current tests/ path.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
gt track 2>&1 || true
```

---

## Task 7: Remove empty test-mirror directories

**Files:**
- Delete: `app/tests/renderer/components/` (empty after Task 4).
- Delete: `app/tests/renderer/main/pages/` (empty after Task 5).
- Delete: `app/tests/renderer/overlay/SetupFlow.test.tsx`'s parent if now empty (unlikely — StepConnect.test.tsx orphans keep `app/tests/renderer/overlay/steps/` alive).

**Interfaces:**
- None.

- [ ] **Step 1: Confirm each candidate dir is empty**

```bash
find app/tests/renderer/components app/tests/renderer/main/pages -type f 2>/dev/null
```

Expected: no output. If any files remain, do NOT delete the dir; investigate the leftover first.

- [ ] **Step 2: Delete the empty dirs**

```bash
rmdir app/tests/renderer/components
rmdir app/tests/renderer/main/pages
rmdir app/tests/renderer/main 2>/dev/null || true   # may still hold other files
```

Only `rmdir` (not `rm -rf`) — this fails safely if the directory has anything left.

- [ ] **Step 3: Full verification**

```bash
PATH=~/Library/pnpm:$PATH pnpm --filter ./app run typecheck && \
  PATH=~/Library/pnpm:$PATH pnpm --filter ./app run lint && \
  PATH=~/Library/pnpm:$PATH pnpm --filter ./app run test
```

Expected: all green (nothing structural changed).

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
chore(tests): remove empty test-mirror directories after renderer co-location

Housekeeping. app/tests/renderer/components/ and main/pages/ are empty
after Tasks 4–5. StepConnect.test.tsx (orphan test) keeps the overlay/steps
mirror partially alive; do not delete that path.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
gt track 2>&1 || true
```

---

## Final verification (all 7 tasks complete)

- [ ] **Full green build:**

```bash
PATH=~/Library/pnpm:$PATH pnpm --filter ./app run typecheck && \
  PATH=~/Library/pnpm:$PATH pnpm --filter ./app run lint && \
  PATH=~/Library/pnpm:$PATH pnpm --filter ./app run test:coverage
```

Coverage percentages should match pre-refactor within noise (nothing removed).

- [ ] **Manual smoke:**

```bash
PATH=~/Library/pnpm:$PATH pnpm dev
```

Exercise: sign-in via Supabase, decompose one goal on Onboarding, open Settings, toggle activity polling, walk through overlay steps. Zero console errors.

- [ ] **Push the stack:**

```bash
git push origin chore/prune-shipped-plans
gt submit --stack 2>&1 || echo "Graphite not initialized — push each branch manually"
```

- [ ] **Cross-check spec:**

Reopen `docs/superpowers/specs/2026-07-21-main-and-renderer-reorganization-design.md`. Every goal listed there must be visibly implemented by one of the commits above. If a goal has no commit, it's an escape.
