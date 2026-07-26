# Try/catch noise cleanup

Small, mechanical extractions surfaced by a full audit of the 54 try/catch
blocks in `app/src/`. See conversation for the bucketing methodology. This plan
only tackles the sites where duplication is *identical* — the React
fetch-then-setState pattern (8 sites) is deferred to a separate convention
conversation because it needs a UX call about mount-time errors.

## Scope

Three concrete, mechanical changes. No new abstractions beyond what the audit
found duplicated verbatim.

### 1. Consolidate the `import.meta.env` guard (4 → 1)

Four files have the *identical* 6-line try/catch reading a key off
`import.meta.env` with a Vite-vs-Node fallback. Extract into one helper.

**New file:** `app/src/main/config/vite-env.ts`

```ts
export function readViteEnv(key: string): string | undefined {
  try {
    const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env;
    const value = env?.[key];
    return value && value.length > 0 ? value : undefined;
  } catch {
    return undefined;
  }
}
```

**Callers to update:**

- `app/src/main/config/env.ts` (line 4-11) — `resolveRequiredEnv`: replace the
  try/catch with `const fromVite = readViteEnv(name); if (fromVite) return fromVite;`
- `app/src/main/auth/signup-flow.ts` (line 18-24) — `getBackendUrl`: same shape.
- `app/src/main/auth/supabase-client.ts` (line 54-61) — `resolveEnv`: same shape.
- `app/src/main/http/authed-fetch.ts` (line 5-11) — `resolveBackendUrl`: same
  shape, but preserve the trailing `.replace(/\/$/, '')` normalization.

**Preserve behavior exactly:**
- Empty-string values must still fall through to the next source (the current
  `if (fromVite && fromVite.length > 0)` check — the helper handles this).
- No new logging.

### 2. Delete the redundant IPC log-then-rethrow wrappers (3 sites)

`app/src/main/ipc.ts` handlers at lines 122-137, 139-154, 156-174 all wrap
their body in `try { … } catch (err) { console.error(...); throw err; }`. The
IPC framework already logs and propagates. These add nothing except a duplicate
log line.

**Do:**
- Remove the try/catch in `auth:signIn` (122-137) — unwrap the body.
- Remove the try/catch in `auth:signInWithPassword` (139-154) — unwrap the body.
- Remove the try/catch in `auth:signUp` (156-174) — unwrap the body.

**Do not touch:**
- `auth:signOut` (176-…) — that catch is deliberate (bucket 3): it swallows the
  remote failure so local sign-out completes. Leave alone.

### 3. Skip the JSON-parse helper — audit revealed only 1 clean site

Re-inspection: of the 3 "JSON.parse fallback" sites the audit flagged, two
(`decompose.ts:44`, `inference.ts:85`) are actually `await response.json()`
(Promise-based, different type) and one (`activity.ts:47`) is
`JSON.parse(string)`. A single site is not enough duplication to justify a
helper. Do nothing here.

## Out of scope (explicit)

- **React fetch/swallow pattern** (8 sites in `Settings.tsx`, `Home.tsx`,
  `AIProgress.tsx`). Needs a UX conversation about whether mount-time fetch
  failures should surface a toast, a retry button, or stay silent. Deferring.
- **`withRetry` generic.** Audit found only one client-side retry site, and it
  already has a dedicated helper (`with-auth-retry.ts`). Nothing to consolidate.
- **`signup-flow.ts:68` silent OAuth URL parse.** Real smell but a behavior
  change (adding logging), not a mechanical extraction. Separate ticket.
- **`inference.ts:63` unauth-retry overlap with `with-auth-retry.ts`.** Same:
  behavior change, not extraction.

## Verification

From repo root:

```
pnpm typecheck && pnpm lint && pnpm test
```

Must pass green. No tests need to be added — all three changes are pure
refactors preserving observable behavior (the IPC changes reduce a duplicate
log line, which is the intended cleanup, not a regression).

Manual smoke: none required. These sites are exercised by existing tests
(`env.ts` via `main/config` tests; auth handlers via IPC integration; the
supabase-client and authed-fetch env-reading is exercised on any startup).

## Files touched

- **New:** `app/src/main/config/vite-env.ts`
- **Modified:** `app/src/main/config/env.ts`
- **Modified:** `app/src/main/auth/signup-flow.ts`
- **Modified:** `app/src/main/auth/supabase-client.ts`
- **Modified:** `app/src/main/http/authed-fetch.ts`
- **Modified:** `app/src/main/ipc.ts`

6 files, ~40 lines removed, ~12 lines added net.
