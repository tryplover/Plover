# Link desktop app to the website's Supabase account

## Context

The website (tryplover.com) creates user accounts via Supabase. The desktop
app currently has **no** knowledge of Supabase — it authenticates against a
completely different, unrelated backend:

- `app/src/main/auth/signup-flow.ts` + `plover-token.ts` do a
  `plover://` deep-link handshake with the hosted `plover-server` Cloud Run
  service (a separate repo, `github.com/tryplover/plover-server`). That
  token (`X-Plover-Auth-Token`) is what authorizes Gemini decompose/inference
  calls through `authed-fetch.ts`.
- `app/src/main/sync/google-auth.ts` is a *third*, independent OAuth client
  for Google Calendar/Drive scopes.

Neither of these touches Supabase. A `feat/supabase-auth-subscription` branch
exists with a full Supabase integration, but it bundles Supabase auth
together with paid/free subscription-status quota gating, and per prior
product discussion that branch is intentionally **not merged** — subscription
gating isn't in Plover's current phase scope. See the `.env.example` comment
on that branch, which confirms the intent directly:

> Supabase (shared with the plover-website project — same anon key, same
> project)

## Scope of this change

**In scope:** give the desktop app a "Plover Account" identity backed by the
same Supabase project as the website, via Google sign-in through Supabase
Auth. This is additive — it does not touch the existing plover-server
Gemini-auth flow or the separate Google Calendar OAuth client, both of which
keep working exactly as they do today.

**Out of scope (explicitly not doing this here):**
- Subscription/plan gating (`profiles.plan`, quota limits, "Upgrade to Pro"
  deep links). That's the piece that got the deferred branch blocked, and
  it's a product-scope decision, not a code change.
- Replacing or modifying the plover-server `X-Plover-Auth-Token` flow that
  Gemini calls rely on. We don't control the plover-server repo from here,
  so we can't safely assume it understands Supabase JWTs.
- Any change to Google Calendar OAuth (`sync/google-auth.ts`).

## Files to add

### `app/src/main/auth/supabase-client.ts` (new)

Singleton Supabase client. Session persistence backed by `keytar`
(`service: 'plover'`, `account: 'supabase-session'` — distinct from the
existing `plover_token` account so the two auth systems never collide).

```ts
import { createClient, SupabaseClient, SupportedStorage } from '@supabase/supabase-js';
import keytar from 'keytar';

const KEYCHAIN_SERVICE = 'plover';
const KEYCHAIN_ACCOUNT = 'supabase-session';

// Supabase computes a storage key internally, but this app only ever caches
// one session per machine, so every key routes through the same fixed
// keytar (service, account) pair.
class KeytarStorage implements SupportedStorage {
  async getItem(): Promise<string | null> {
    return keytar.getPassword(KEYCHAIN_SERVICE, KEYCHAIN_ACCOUNT);
  }
  async setItem(_key: string, value: string): Promise<void> {
    await keytar.setPassword(KEYCHAIN_SERVICE, KEYCHAIN_ACCOUNT, value);
  }
  async removeItem(): Promise<void> {
    await keytar.deletePassword(KEYCHAIN_SERVICE, KEYCHAIN_ACCOUNT);
  }
}

function resolveEnv(key: 'SUPABASE_URL' | 'SUPABASE_ANON_KEY'): string {
  try {
    const fromVite = (import.meta as unknown as { env?: Record<string, string | undefined> }).env?.[key];
    if (fromVite) return fromVite;
  } catch {
    // import.meta.env not defined outside the Vite-built bundle (tests, etc.)
  }
  return process.env[key] ?? '';
}

let client: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (!client) {
    client = createClient(resolveEnv('SUPABASE_URL'), resolveEnv('SUPABASE_ANON_KEY'), {
      auth: {
        storage: new KeytarStorage(),
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
        flowType: 'pkce',
      },
    });
  }
  return client;
}

export function _resetClientForTests(): void {
  client = null;
}
```

Use the `import.meta.env` + `process.env` fallback (same pattern as
`resolveBackendUrl()` in `authed-fetch.ts`) rather than `process.env` alone,
so the value can be baked into packaged builds the same way
`PLOVER_BACKEND_URL` is — see the `electron.vite.config.ts` change below.
Add a test-only reset export since the client is a module-level singleton and
tests need to force recreation with mocked env vars.

### `app/src/main/auth/supabase-auth.ts` (new)

Adapted from the deferred branch's version, **minus** `fetchSubscriptionPlan`
(that's the subscription-gating piece, dropped per scope above). Same
loopback-HTTP-server PKCE pattern as `google-auth.ts` — Supabase's
`signInWithOAuth({ provider: 'google', skipBrowserRedirect: true })` gives a
URL to open in the system browser; the redirect lands on
`http://localhost:<ephemeral-port>` where a one-shot local server catches the
`code` and calls `exchangeCodeForSession`.

Exports: `signIn(): Promise<void>`, `signOut(): Promise<void>`,
`restoreSession(): Promise<boolean>`, `startAutoRefresh(): void`,
`getCurrentUser(): Promise<{ id: string; email: string | null } | null>`,
and `SupabaseAuthenticationError`.

Port the body from `origin/feat/supabase-auth-subscription:app/src/main/auth/supabase-auth.ts`
verbatim except deleting the `fetchSubscriptionPlan` export.

## Files to change

### `app/package.json`
Add `"@supabase/supabase-js": "^2.110.0"` to `dependencies`.

### `app/electron.vite.config.ts`
- Add `'@supabase/supabase-js'` to the `main.build.rollupOptions.external`
  array (it's a real npm dep at runtime, not something to bundle — same
  treatment as `googleapis`).
- Extend the existing `define` block (don't replace it — keep
  `PLOVER_BACKEND_URL`) with:
  ```ts
  'import.meta.env.SUPABASE_URL': JSON.stringify(process.env.SUPABASE_URL ?? ''),
  'import.meta.env.SUPABASE_ANON_KEY': JSON.stringify(process.env.SUPABASE_ANON_KEY ?? ''),
  ```

### `app/src/main/env.d.ts`
Add `SUPABASE_URL` and `SUPABASE_ANON_KEY` to the `ImportMetaEnv` interface
alongside the existing `PLOVER_BACKEND_URL`.

### `app/.env.example`
Append (matching the deferred branch's wording, minus the website-upgrade-link
bit which is subscription-scoped):
```
# Supabase (shared with the plover-website project — same anon key, same project)
# Get these from the Supabase dashboard: Settings -> API.
# NEVER add SUPABASE_SERVICE_ROLE_KEY here. The desktop app must only ever
# hold the anon key; the service-role key is website/backend-only and can
# bypass row-level security.
SUPABASE_URL=
SUPABASE_ANON_KEY=
```

### `app/src/main/store/repos/settings.ts`
Add two nullable fields to `SettingsData`: `supabaseUserId: string | null`,
`supabaseUserEmail: string | null`. Follow the existing `lastInferenceTs`
pattern exactly (that's the existing nullable-string field) for both the
`getAll()` read and the `update()` write (null → `deleteStmt.run(...)`,
non-null → `this.set(...)`).

### `app/src/main/ipc.ts`
- Import `* as supabaseAuth from './auth/supabase-auth.js'`.
- Near the top of `setupIpcHandlers`, alongside the existing
  `void googleAuth.loadSavedCredentials();`, add a best-effort session
  restore that doesn't throw on failure:
  ```ts
  void supabaseAuth.restoreSession().then((hasSession) => {
    if (hasSession) supabaseAuth.startAutoRefresh();
  });
  ```
- Add three new handlers near the existing `signup:start` handler:
  - `auth:signIn` — call `supabaseAuth.signIn()`, then
    `supabaseAuth.getCurrentUser()`; if no user, throw. Otherwise
    `settingsRepo.update({ supabaseUserId: user.id, supabaseUserEmail: user.email })`,
    broadcast `'auth:status-changed'` with `{ signedIn: true, email: user.email }`,
    and return that status.
  - `auth:signOut` — `supabaseAuth.signOut()`, then
    `settingsRepo.update({ supabaseUserId: null, supabaseUserEmail: null })`,
    broadcast `{ signedIn: false, email: null }`, return it.
  - `auth:getStatus` — read `settingsRepo.getAll()`, return
    `{ signedIn: !!settings.supabaseUserId, email: settings.supabaseUserEmail }`.
- Wrap `signIn`/`signOut` handler bodies in try/catch that logs and rethrows
  (matching the existing `calendar:connect` error-handling style in this
  file) so IPC failures surface a real error to the renderer instead of an
  opaque rejection.

### `app/src/preload/index.ts`
Add to `PloverApi`:
```ts
auth: {
  signIn: () => Promise<{ signedIn: boolean; email: string | null }>;
  signOut: () => Promise<{ signedIn: boolean; email: string | null }>;
  getStatus: () => Promise<{ signedIn: boolean; email: string | null }>;
};
```
And the corresponding `api` object entries invoking `auth:signIn`,
`auth:signOut`, `auth:getStatus`. Follow the existing `signup: {...}` block
immediately above/below it for style.

### `app/src/renderer/global.d.ts`
Mirror the same `auth: {...}` shape into `PloverAPI` (this file duplicates
preload's types for renderer-only consumers — keep both in sync, same as the
existing `signup` block does).

### `app/src/renderer/main/pages/Settings.tsx`
In the existing "Account" card (the one currently containing only the
"Google Calendar" row, around line 258), add a "Plover Account" row above the
Google Calendar row, following the exact same layout/style (status dot +
email when signed in, connect/disconnect button). On mount, call
`window.api.auth.getStatus()` to populate initial state; subscribe to
`window.api.on('auth:status-changed', ...)` for live updates (same pattern
other Settings state already uses for `googleConnected`). Button calls
`window.api.auth.signIn()` / `.signOut()`.

## Tests to add

- `app/tests/main/auth/supabase-client.test.ts` — mirrors
  `app/tests/main/auth/plover-token.test.ts` in style: mock `keytar`, verify
  `getItem`/`setItem`/`removeItem` hit the right service/account, and that
  `getSupabaseClient()` is a singleton (same object on repeat calls) that
  resets via `_resetClientForTests()`.
- `app/tests/main/auth/supabase-auth.test.ts` — mock `@supabase/supabase-js`'s
  client (via `getSupabaseClient`) and `electron.shell.openExternal`. Cover:
  `signIn()` opens the OAuth URL and resolves after a mocked
  `exchangeCodeForSession` succeeds; rejects on OAuth `error` param; rejects
  on `exchangeCodeForSession` error; `getCurrentUser()` maps
  `data.user`/`null` correctly; `signOut()` calls `auth.signOut()`.
- `app/tests/main/ipc.test.ts` (extend existing file) — add cases for
  `auth:signIn`, `auth:signOut`, `auth:getStatus` following the existing
  mocking pattern in that file (it already mocks other ipc handlers'
  dependencies).
- `app/tests/store/settings-repo.test.ts` (extend) — round-trip
  `supabaseUserId`/`supabaseUserEmail` through `update()`/`getAll()`,
  including the null-clears-the-row case (mirrors the existing
  `lastInferenceTs` null-handling test if one exists, otherwise add one next
  to it).
- `app/tests/renderer/main/pages/Settings.test.tsx` (extend) — render with a
  mocked `window.api.auth`, verify sign-in/out buttons call the right IPC and
  the row reflects `getStatus()`'s initial value.

## Verification

1. `pnpm typecheck && pnpm lint && pnpm test` (or
   `pnpm --filter ./app run test:coverage` if touching
   `src/main/store/**`, which is coverage-gated) — must be green.
2. Manual: this can't be smoke-tested end-to-end without real
   `SUPABASE_URL`/`SUPABASE_ANON_KEY` values in `app/.env` (see
   lessons-learned in `CLAUDE.md` about GUI apps not being launchable via the
   Bash/PowerShell tool for visual verification on this machine — same
   caveat applies here). Note in the PR description that a human needs to
   drop real Supabase project credentials into `app/.env` and manually click
   through sign-in/sign-out in Settings before merging.
3. CI (`release.yml`) will need a new `SUPABASE_URL`/`SUPABASE_ANON_KEY`
   repo secret to bake into packaged builds, same as `PLOVER_BACKEND_URL` —
   flag this in the PR description as a follow-up the user needs to do in
   GitHub repo settings; don't attempt to add secrets from this session.

## Explicitly not touching

`signup-flow.ts`, `plover-token.ts`, `with-auth-retry.ts`, `authed-fetch.ts`,
`google-auth.ts`, and every callsite that currently uses them
(`planner/decompose.ts`, `activity/screen-capturer.ts`,
`activity/inference.ts`, `activity/git-commit-tracker.ts`). Those keep
working exactly as today.
