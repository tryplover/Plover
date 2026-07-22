# Further Bloat Cleanup

Second pass over the codebase after the unreachable-features prune (#259).
Deletes internal dead code: stale type declarations, single-use helpers,
files nothing imports, and stale build config. **~300 LOC net removal.**

## Scope

Conservative pass — leaves anything with genuine reuse potential or judgment
calls (see "Out of scope" at the end).

## Changes

### 1. Reduce `app/src/renderer/global.d.ts` to just the `Window.api` shim

**Problem.** The file declares a whole `PloverAPI` interface (note wrong
casing vs preload's `PloverApi`) with a stale shape — it still references
`signup` after the prior PR removed it, and is missing ~10 methods that
`preload/index.ts`'s `PloverApi` actually has. It only compiles because
`skipLibCheck: true` in `tsconfig.json` suppresses conflict with preload's
own `declare global { interface Window { api: PloverApi } }`.

**Fix.** Delete everything except the `ImportMetaEnv`/`ImportMeta` block.
The `Window.api: PloverApi` augmentation is already provided by
`preload/index.ts` — no need to duplicate it here. Delete the
`ProposedPlan` and `PloverAPI` interfaces entirely.

**Final `app/src/renderer/global.d.ts` should look like:**

```ts
interface ImportMetaEnv {
  readonly PLOVER_VERSION: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
```

**Verify:** After the change, grep for any file that imports `ProposedPlan`
from `'../global'` or `'../../renderer/global'`. If any, redirect them to
import from `'../../preload'` (which is the source of truth already used
by `overlay/steps/StepBreakdown.tsx`).

### 2. Delete `app/src/renderer/lib/date.ts` and its test

`isToday()` is only imported by its own test. `AIProgress.tsx` has an
unrelated local `const isToday` (shadowing name, not this function).

**Delete:**
- `app/src/renderer/lib/date.ts`
- `app/tests/renderer/date.test.ts` (verify the filename with `find`; the
  scan referenced `app/tests/renderer/date.test.ts` but confirm before
  deleting).

If `app/src/renderer/lib/` becomes empty after also deleting `async.ts` in
step 6, delete the directory.

### 3. Delete stale `@google/generative-ai` external

**Edit `app/electron.vite.config.ts`:** remove the line
`'@google/generative-ai',` from `main.build.rollupOptions.external`.

The package is not in `app/package.json` deps and no source file imports
it — the backend proxy split moved Gemini calls to the server. This is
leftover config.

### 4. Delete the `.skip`ped test in `tests/main/ipc.test.ts:154`

`it.skip('activity:purge with olderThan unlinks screenshot files before
purging DB rows', ...)` — skipped indefinitely.

**Fix.** Delete the entire `it.skip(...)` block. If the `describe` it
lives in becomes empty, delete that too.

Rationale: this PR is a cleanup pass, not a bug hunt. A skipped test is
noise, not coverage; delete it. If the underlying `activity:purge`
behavior needs test coverage, that's a follow-up task, not scope creep
here.

### 5. Delete `AppRow.tsx` + `AppRow.css` and remove from ComponentGallery

`AppRow` is imported only by `dev/ComponentGallery.tsx` (a dev-only visual
review tool gated behind `import.meta.env.DEV && ?gallery=1`). It's not
used in any real page/route.

Keep the gallery — it still has utility for the 5 other components it
demos. Just remove the AppRow entry.

**Delete:**
- `app/src/renderer/components/AppRow.tsx`
- `app/src/renderer/components/AppRow.css`

**Edit `app/src/renderer/dev/ComponentGallery.tsx`:**
- Remove `import { AppRow } from '../components/AppRow';`
- Remove the `<section>` block that renders `<AppRow>` demos.

Grep for any other importer of `AppRow` (there shouldn't be any) — if
found, stop and re-scope.

### 6. Inline `safeAsync` at its single call site and delete `lib/async.ts`

`safeAsync` is defined in `app/src/renderer/lib/async.ts` and used only at
`app/src/renderer/overlay/SetupFlow.tsx:28`. It's a 10-line generic wrapper
where the single call is `safeAsync(() => window.api.closeOverlay())`.

**Edit `app/src/renderer/overlay/SetupFlow.tsx`:**
- Remove the `import { safeAsync } from '../lib/async';` line.
- Replace the `closeOverlay` binding with a direct fire-and-forget:

  ```ts
  const closeOverlay = () => {
    window.api.closeOverlay().catch((err) => {
      console.error('Unhandled promise rejection:', err);
    });
  };
  ```

**Delete `app/src/renderer/lib/async.ts`.**

If `app/src/renderer/lib/` becomes empty (with date.ts also gone), delete
the directory.

### 7. Delete unused `@renderer/*` path alias

Zero usages in `app/src` or `app/tests`.

**Edit `app/tsconfig.json`:**
- Remove the `"@renderer/*": ["src/renderer/*"]` entry from `paths`.

**Edit `app/electron.vite.config.ts`:**
- Remove the `'@renderer': resolve('src/renderer'),` alias from the
  `renderer.resolve.alias` block.

Keep `@main` and `@shared` — those are actively used.

## Verification

From repo root:

```
pnpm typecheck && pnpm lint && pnpm test
```

Expected baseline: 46 test files pass (298 tests / 1 skipped). Two files
(`tests/renderer/App.test.tsx`, `tests/renderer/main/pages/Onboarding.test.tsx`)
have preexisting-broken `localStorage` mocking issues that reproduce on
`main` before this diff. This PR should not affect their status.

## Explicitly out of scope (do NOT touch)

- **`withAuthRetry` / `startSignup` 401-retry path.** It's dead but
  represents a real feature (auto re-auth on Supabase session expiry) that
  we shouldn't silently drop. Follow-up task: wire it around the 4
  `authedFetch()` call sites, or explicitly decide to drop it.
- **Keychain accessor duplication** between `plover-token.ts` and
  `supabase-client.ts`. ~10 lines saved isn't worth an abstraction.
- **`_clearPendingForTests` / `_resetClientForTests`.** Legitimate test
  seams for singleton state.
- **`tslib` root devDep.** Needed under pnpm for `@peculiar/utils` — see
  `CLAUDE.md` lessons-learned entry 2026-06-12.
- **ComponentGallery itself.** Kept for the 5 other components it demos.
