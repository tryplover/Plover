# Plan: Import hygiene — prefer path aliases; reconcile `@renderer`

## Context

`app/tsconfig.json` defines `paths` for `@main/*` → `src/main/*` and `@shared/*`
→ `src/shared/*`. The electron-vite main build and vitest also wire these. Two
problems:

1. **Config drift.** `app/vitest.config.ts` defines a third alias, `@renderer`
   → `src/renderer`, that `tsconfig.json` and both vite builds do **not**
   define. It is used in **0 files**. This is an inconsistency to remove.
2. **Relative-import sprawl.** `src/main` has ~91 imports with 2+ leading `../`.
   The recent `activity/` domain regroup made this worse — moved files now reach
   3–5 levels up into `store/`, `http/`, `events/`, `lifecycle/`,
   `permissions/`, and `shared/`. These cross-boundary imports should use the
   `@main/*` / `@shared/*` aliases.

Scope decision (confirmed): convert **all** cross-boundary imports (≥2 `../`)
across `src/main`; remove the unused `@renderer` alias.

## Changes

### 1. Remove the `@renderer` alias from `app/vitest.config.ts`

Delete the `'@renderer': resolve('src/renderer'),` line from the
`resolve.alias` block. Result: `{@main, @shared}` agree across `tsconfig.json`,
the main vite build, and vitest. The renderer vite build stays `@shared`-only
(correct — renderer must not import `@main`, per the process boundary). No
source uses `@renderer`, so nothing else changes.

### 2. Convert cross-boundary relative imports in `app/src/main/**/*.ts`

**Rule (mechanical, deterministic):** for every import/export specifier that
begins with **two or more** `../`:

1. Resolve it to an absolute path relative to the importing file.
2. If it lands under `src/main/…` → rewrite to `@main/<rest>`.
3. If it lands under `src/shared/…` → rewrite to `@shared/<rest>`.
4. **Keep the trailing `.js` extension** (the repo uses explicit `.js`
   specifiers; `@main/store/repos/activity.js` already resolves under the
   `Bundler` moduleResolution — existing test imports prove this).

**Do NOT touch:**
- Specifiers starting with `./` (same dir).
- Specifiers with exactly **one** `../` (immediate parent — short and readable;
  left relative on purpose).
- Bare/package specifiers (`electron`, `node:path`, `@google/…`, etc.).

Applies to both `import` and `export … from` statements, and both `import type`
and value imports.

Worked examples:
- In `src/main/activity/sources/google/gmail-subscriber/gmail-subscriber.ts`:
  - `'../../../../store/repos/activity.js'` → `'@main/store/repos/activity.js'`
  - `'../../../../../shared/events.js'` → `'@shared/events.js'`
  - `'../../../shared/gate.js'` (activity-local shared) →
    `'@main/activity/shared/gate.js'`
- In `src/main/activity/processing/inference/inference.ts`:
  - `'../../../store/repos/tasks.js'` → `'@main/store/repos/tasks.js'`
  - `'../../../../shared/types.js'` → `'@shared/types.js'`
- A `store/repos/tasks.ts` importing `'../db.js'` (one `../`) → **unchanged**.

### 3. Out of scope (do not touch)

- `app/tests/**` — tests already use `@main`; leave as-is this pass.
- `src/renderer`, `src/preload`, `src/shared` internal imports — scope is
  `src/main` cross-boundary sprawl.
- Single-`../` imports anywhere.

## Verification (must be green before done)

From repo root:
```
pnpm typecheck && pnpm lint && pnpm --filter ./app run test
```
`tsc` (Bundler resolution honoring tsconfig `paths`) will flag any mis-resolved
alias as module-not-found, so green typecheck is the primary signal the mapping
is correct.

Then confirm no cross-boundary relative imports remain in `src/main`:
```
grep -rn -E "from '(\.\./){2,}" app/src/main --include='*.ts'   # expect: no output
```
And confirm `@renderer` is gone:
```
grep -rn "@renderer" app/                                        # expect: no output
```

Known pre-existing renderer test failures (`App.test.tsx`, `Home.test.tsx`,
`Onboarding.test.tsx` — `localStorage` family, see `plover-testing` skill) are
unrelated; leave them.
