# Supabase auth + subscription-status gating for Plover desktop

## Context

Plover has a companion marketing/billing site (`plover-website`, sibling repo at
`C:\Users\hhl_c\Documents\GitHub\plover-website`) that already runs Stripe
checkout through a Supabase project: on `checkout.session.completed` its
Express backend sets `profiles.plan = 'paid'` (keyed by `client_reference_id`,
the Supabase auth user id), and on `customer.subscription.deleted` sets it back
to `'free'`. Today the Electron desktop app has no concept of a signed-in user
or subscription tier at all — it's purely local-first. The goal is to let a
user who already has an account (and possibly already subscribed) on the
website sign in from the desktop app and have the app recognize their `paid`
vs `free` status, then enforce the same plan limits the website advertises:
**Basic (free) = 10 tasks planned per week, Pro (paid) = unlimited.**

This does not touch Stripe checkout itself (stays on the website) and does not
add a second copy of the `profiles` table or any new backend service — the
desktop app only ever reads from the same Supabase project the website
already uses, via the public anon key (never the service-role key).

Decisions already made with the user:
- Sign-in is OAuth via browser redirect through Supabase (not email/password),
  mirroring the existing Google Calendar OAuth loopback-server pattern already
  in `app/src/main/sync/google-auth.ts`. Verified against
  `plover-website/src/components/shared/AuthModal.jsx`: the website supports
  **both** email/password and `signInWithOAuth({ provider: 'google' })` — so
  `'google'` is the correct, already-configured provider to reuse for desktop.
- The only gated feature is a **weekly task-creation quota**: free-tier users
  can create at most 10 tasks/week (across all goals); paid users are
  unlimited. No other feature is blocked.

## Verified facts (read directly from both repos — do not re-derive)

**Website side (`plover-website`)**
- `server/server.js`: `checkout.session.completed` → `supabase.from('profiles').update({ plan: 'paid', stripe_customer_id: session.customer }).eq('id', session.client_reference_id)`. `customer.subscription.deleted` → `.update({ plan: 'free' }).eq('stripe_customer_id', ...)`. `client_reference_id` is set to the Supabase user id at checkout-session creation.
- `src/components/shared/AuthModal.jsx`: calls `supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: `${window.location.origin}/` } })` for social login, and `supabase.auth.signInWithPassword` / `signUp` for email+password. Confirms Google is a live, working OAuth provider on this Supabase project.
- **No committed SQL/RLS migration file exists in either repo.** The `profiles` table and its row-level-security policy were set up by hand in the Supabase dashboard. **This is a hard prerequisite, not something code can work around:** before wiring up `fetchSubscriptionPlan`, confirm in the Supabase dashboard (Authentication → Policies, or SQL editor `pg_policies`) that an authenticated user can `SELECT plan FROM profiles WHERE id = auth.uid()` via the anon key. If missing, add that policy first.
- **Also a hard prerequisite:** Supabase's Auth → URL Configuration → **Redirect URLs** allow-list must include a pattern that matches the desktop app's loopback callback (e.g. `http://127.0.0.1:*` — Supabase supports `*` wildcards in redirect URL entries). The website's redirect (`window.location.origin`) won't match a `127.0.0.1:<random-port>` desktop callback, so without this the OAuth flow will fail at the "Redirects user back" step with an invalid-redirect error. Flag to the user during implementation; it may already be permissive enough (worth checking before assuming it needs a change).

**Plover app side**
- **Google OAuth token pattern** (`app/src/main/sync/google-auth.ts`): `KEYCHAIN_SERVICE = 'plover'`, `KEYCHAIN_ACCOUNT = 'google-refresh-token'`. `authorize()` opens a loopback `http.createServer()` on port 0, builds an auth URL with a random `state`, `shell.openExternal(authUrl)`, listens for the callback request with `?code=`, validates `state`, exchanges the code, then `keytar.setPassword(...)`. Has a 5-min timeout and a `finish()` cleanup helper. `loadSavedCredentials()` reads the token back on startup; `disconnect()` deletes it. **No test file exists for this module** — OAuth loopback flows are treated as integration-heavy and excluded from the coverage gate, which sets precedent for how lightly the new Supabase auth module needs to be tested.
- **Env loading**: `app/src/main/load-env.ts` is imported as the literal first line of `app/src/main/index.ts` — this ordering is load-bearing (ESM import hoisting). `app/.env.example` currently has `PLOVER_BACKEND_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`.
- **IPC bridge**: `app/src/preload/index.ts` defines `PloverApi` (typed interface + `ipcRenderer.invoke` implementation + `contextBridge.exposeInMainWorld('api', api)`), plus a generic `on(channel, callback)` subscriber already used for ad-hoc broadcast channels. `app/src/main/ipc.ts` registers `ipcMain.handle('domain:action', ...)` handlers grouped by comment-delimited sections (`// Goals`, `// Calendar`, etc.), and has a `broadcast(channel, payload)` helper that sends to all `BrowserWindow`s. `setupIpcHandlers(...)` is where startup side effects like `void googleAuth.loadSavedCredentials()` already live.
- **Single choke point for task creation**: `saveGoalAndTasksInternal(goalInput, subtaskInputs, scheduledSlots)` in `app/src/main/ipc.ts` (~line 424) is the *only* place `tasksRepo.create(...)` is called. It backs both the `'goals:save'` handler and the overlay `'goal:commit'` handler. This is the one place the weekly quota check needs to live.
- **Renderer error surfacing already works**: `app/src/renderer/overlay/QuickAdd.tsx`'s call to `window.api.saveGoalAndTasks(...)` is wrapped in `try/catch` that does `setErrorMessage(err instanceof Error ? err.message : 'Failed to save goal')`, which is already rendered to the user. A rejected IPC promise's `.message` from the quota check will show up with **no renderer code changes needed** — just make the message good. This is currently the only call site for `saveGoalAndTasks`.
- **`TasksRepo`** (`app/src/main/store/repos/tasks.ts`) has `create/get/listByGoal/listScheduledBetween/update/list/listActiveScheduledBefore`, all raw `better-sqlite3` prepared statements — no `countCreatedBetween` yet.
- **`SettingsRepo`** (`app/src/main/store/repos/settings.ts`) is a key-value store: `SettingsData` interface, `getAll()` reads each key with a default, `update(patch)` writes each provided key; nullable string fields (like `lastInferenceTs`) use an explicit `DELETE FROM settings WHERE key = ?` when patched with `null`. New keys need **no DB migration** — this is the established pattern for every setting added after the original schema. Test file `app/tests/store/settings-repo.test.ts` mirrors this exactly (in-memory DB + `runMigrations`, defaults + roundtrip assertions).
- **Coverage gate**: soft 60% applies only to `src/main/planner/**` and `src/main/store/**`. So the pure quota-limit logic belongs under `app/src/main/planner/` (testable, gated), while the OAuth/Supabase-client plumbing belongs under a new `app/src/main/auth/` (untested-by-gate, like `sync/`).
- **Dependencies/build**: `app/package.json` has `keytar`, `google-auth-library`, `googleapis`, `better-sqlite3`; no `@supabase/supabase-js` yet. `app/electron.vite.config.ts` externalizes `electron, better-sqlite3, chokidar, get-windows, keytar, google-auth-library, googleapis, @google/generative-ai` in the main build — must add `@supabase/supabase-js` there too, and watch for a `ws`-related bundling error (supabase-js's realtime client can pull in `ws`; Node 22 has a native `WebSocket` so this may resolve cleanly, but verify empirically rather than pre-guessing, per this repo's own documented bundling footguns).
- **Settings UI** (`app/src/renderer/main/pages/Settings.tsx`): existing "Account" card (~line 215) does Google Calendar connect/disconnect via `window.api.connectCalendar()/disconnectCalendar()`. No modal system; sections are plain `<div>` cards styled with CSS vars (`--plover-surface`, etc.) and a shared `<Button variant="primary"|"secondary">` component. State is local `useState` only.

## Implementation (ordered workstreams — each is a reasonable subagent task)

### 1. Store & planner layer (independent, do first)

- **`app/src/main/store/repos/tasks.ts`**: add `countCreatedBetween(start: Date, end: Date): number`, following the exact style of `listScheduledBetween` (prepared statement, ISO string bounds, half-open interval `created_at >= start AND created_at < end`). Add/extend `app/tests/store/tasks-repo.test.ts` (check with Glob whether it exists first) covering an empty window, a boundary case, and counting across multiple goals.
- **New `app/src/main/planner/quota.ts`** (pure, coverage-gated):
  ```ts
  export const FREE_WEEKLY_TASK_LIMIT = 10;
  export function getWeekBoundaries(now: Date): { weekStart: Date; weekEnd: Date };
  export function isWithinWeeklyTaskQuota(plan: 'paid' | 'free', tasksCreatedThisWeek: number, tasksAboutToCreate: number): boolean;
  ```
  Week = Monday 00:00 local time through next Monday 00:00, half-open. `isWithinWeeklyTaskQuota` checks the **whole incoming batch** (`tasksAboutToCreate`), not one task at a time — `saveGoalAndTasksInternal` creates all of a goal's subtasks in one call, so a per-task check would let a 15-subtask goal bypass a 10/week cap. Add `app/tests/planner/quota.test.ts`: paid always passes; free at 9+1 passes; free at 10+1 fails; free at 5+6 fails (batch, not incremental); week rollover at Monday midnight using fixed `Date` fixtures (not `Date.now()`).

### 2. Auth module (`app/src/main/auth/`, independent of workstream 1)

- **`supabase-client.ts`**: singleton client via `createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, { auth: { storage: <keytar adapter>, persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, flowType: 'pkce' } })`. Implement a small class implementing supabase-js's `SupportedStorage` interface backed by `keytar.getPassword/setPassword/deletePassword('plover', 'supabase-session')` — one cached session per machine, matching the existing single-account Google precedent. `detectSessionInUrl: false` because there's no browser URL to inspect in the main process; the loopback server below does the code exchange manually.
- **`supabase-auth.ts`**: mirror `google-auth.ts`'s loopback-server shape for `signIn()`:
  - `supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: 'http://127.0.0.1:<port>', skipBrowserRedirect: true } })` → get `data.url`, `shell.openExternal(data.url)`.
  - Loopback server receives the redirect's `?code=`, calls `supabase.auth.exchangeCodeForSession(code)` to complete the PKCE flow. **Verify this exact method name against the installed `@supabase/supabase-js` version's types once it's added** — Supabase has renamed/reshaped this API across major versions; don't trust a training-data guess blindly.
  - `signOut()` → `supabase.auth.signOut()`. `restoreSession()` → `supabase.auth.getSession()`, returns whether a session exists. `startAutoRefresh()` → `supabase.auth.startAutoRefresh()` (must be called explicitly — Node has no window-focus events to drive Supabase's default auto-refresh timer). `getCurrentUser()` → `{ id, email }` from `supabase.auth.getUser()`.
  - `fetchSubscriptionPlan(userId): Promise<'paid'|'free'>` → `supabase.from('profiles').select('plan').eq('id', userId).maybeSingle()`; **fail closed** — any error, missing row, or non-`'paid'` value returns `'free'`.
  - No dedicated test file needed for this module (matches the untested `google-auth.ts` precedent); the pure gating logic is fully covered by workstream 1's tests instead.

### 3. `SettingsRepo` additions (mirrors workstream 1's patterns)

Add to `SettingsData`: `supabaseUserId: string | null`, `supabaseUserEmail: string | null`, `subscriptionPlan: 'paid' | 'free'`, `subscriptionCheckedAt: string | null`. In `getAll()`, default the three nullable fields to `null` and `subscriptionPlan` to `'free'`. In `update()`, use the existing `lastInferenceTs`-style explicit-`null`-clears-the-row pattern for the three nullable fields, and a plain `set()` for `subscriptionPlan`. No migration needed. Extend `app/tests/store/settings-repo.test.ts` with defaults + roundtrip + null-clear cases.

**Do not store session tokens here** — those live only in keytar (workstream 2). This repo only caches non-sensitive display/gating metadata.

### 4. `ipc.ts` wiring (depends on 1–3)

- Import `* as supabaseAuth from './auth/supabase-auth.js'` and the quota helpers from `./planner/quota.js`; add `import { shell } from 'electron';` (not yet imported in this file).
- In `setupIpcHandlers`, alongside `void googleAuth.loadSavedCredentials();`, add `void restoreSupabaseSessionAndRefreshPlan();` — a local async function that calls `startAutoRefresh()`, `restoreSession()`, and if a session exists, `getCurrentUser()` + `fetchSubscriptionPlan()`, writing the result into `settingsRepo`.
- New `// Auth` section with handlers `auth:signIn`, `auth:signOut`, `auth:getStatus`, `auth:refreshSubscription`, `auth:openUpgradePage`. Each auth-state-changing handler updates `settingsRepo` and calls `broadcast('auth:status-changed', status)` directly (skip the internal `eventBus`/`EventPayloads` — nothing in the main process needs to react to auth changes, only the renderer, and other broadcast-only channels like `goal:created` already use this direct-channel pattern without going through `eventBus`).
- `auth:openUpgradePage` opens `` `${process.env.PLOVER_WEBSITE_URL || 'https://tryplover.com'}/pricing` `` via `shell.openExternal`. Confirm the real production domain with the user rather than shipping a guessed fallback permanently.
- **Quota enforcement**: as the first statement in `saveGoalAndTasksInternal`, before `goalsRepo.create(...)`:
  ```ts
  const settings = settingsRepo.getAll();
  if (settings.subscriptionPlan !== 'paid') {
    const { weekStart, weekEnd } = getWeekBoundaries(new Date());
    const createdThisWeek = tasksRepo.countCreatedBetween(weekStart, weekEnd);
    if (!isWithinWeeklyTaskQuota('free', createdThisWeek, subtaskInputs.length)) {
      throw new Error(
        `You've reached the free plan's limit of ${FREE_WEEKLY_TASK_LIMIT} tasks per week. Upgrade to Pro for unlimited tasks, or wait until next week.`,
      );
    }
  }
  ```
  This single insertion point covers both `'goals:save'` and `'goal:commit'` — no duplicate check elsewhere.

### 5. `preload/index.ts` (depends on 4's channel names/shapes)

Add an `AuthStatus` type (`{ signedIn: boolean; email: string | null; plan: 'paid' | 'free' }`) and extend `PloverApi` with `signIn/signOut/getAuthStatus/refreshSubscription/openUpgradePage`, each wrapping the matching `ipcRenderer.invoke('auth:...')` call. No change needed to the generic `on(channel, callback)` mechanism — the renderer can call `window.api.on('auth:status-changed', ...)` directly, same as other broadcast channels.

### 6. Renderer UI (depends on 5)

- **`Settings.tsx`**: add `authStatus`/`authBusy` state, fetch on mount (`window.api.getAuthStatus()`), subscribe to `'auth:status-changed'` (mirror however an existing component already subscribes to a broadcast channel — check the exact cleanup shape before copying). Add `handleSignIn/handleSignOut/handleRefreshSubscription`. Add a new "Plover Account" card (same styling as the existing "Account" card) showing email + plan (`Pro` vs `Basic (10 tasks/week)`), a sign-in/out button, a "Refresh status" button when signed in, and an "Upgrade to Pro" button (calls `openUpgradePage()`) shown only when signed in on the free plan. Verify the `Button` component's actual `variant` prop values from `app/src/renderer/components/Button.tsx` before use.
- **`QuickAdd.tsx`**: no code changes — verify only that its existing `catch` block still surfaces `err.message` as-is (confirmed above).

### 7. Config & docs (do last)

- **`app/package.json`**: add `@supabase/supabase-js` (use current latest stable major at implementation time, don't guess a version).
- **`app/electron.vite.config.ts`**: add `'@supabase/supabase-js'` to `main.build.rollupOptions.external`. Run `pnpm dev` / `pnpm build` after adding the dependency and watch for a `ws`/`bufferutil`/`utf-8-validate` resolution error; add `'ws'` to the same array only if that actually happens.
- **`app/.env.example`**: add `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `PLOVER_WEBSITE_URL`, with an explicit comment that `SUPABASE_SERVICE_ROLE_KEY` must never be added here (website/backend-only, bypasses RLS).
- **`CLAUDE.md`**: (a) add `- **Auth** (app/src/main/auth/) is the only module that talks to Supabase.` to the architecture-rules list; (b) append the Supabase project's domain to the outbound-HTTP-allowlist bullet (get the real project ref from the user/`.env`, don't fabricate one); (c) add a one-line note documenting the 10-tasks/week free-tier limit and where it's enforced.

## Verification

1. `pnpm typecheck && pnpm lint && pnpm test` from repo root.
2. `pnpm --filter ./app run test:coverage` — confirm `src/main/planner/**` and `src/main/store/**` (now including `quota.ts`, `countCreatedBetween`, and the new settings fields) stay at/above the 60% soft gate.
3. Manual walkthrough with a real `app/.env` pointing at the shared Supabase project:
   - `pnpm dev` → Settings → "Sign in" → confirm a browser window opens to Google's consent screen via Supabase's hosted OAuth redirect, completes, and the loopback page shows success.
   - Confirm email + plan render in Settings matching the user's actual `profiles.plan` row (check via Supabase dashboard, or by having completed a real Stripe checkout on the website first).
   - Quit and relaunch — confirm sign-in persists without re-prompting (session restored from keytar).
   - As a free-plan user, create tasks (via overlay quick-add) until 10 exist for the current week; confirm the 11th is rejected with the upgrade-limit message shown in the overlay's error UI.
   - Flip that user's `profiles.plan` to `'paid'` in the Supabase dashboard, click "Refresh status", confirm the UI flips to Pro and an 11th+ task now succeeds.
   - "Sign out" → confirm Settings reverts to signed-out/Basic and relaunching doesn't auto-restore a session.

## Open risks to flag to the user during/after implementation (not blockers to starting, but must be resolved before shipping)

1. `profiles` RLS policy for self-select via anon key is unverified in the dashboard (no migration file in either repo) — confirm or add it first.
2. Supabase's Auth "Redirect URLs" allow-list must permit the desktop loopback callback (`http://127.0.0.1:*`) — confirm/add in the dashboard.
3. `exchangeCodeForSession`'s exact API shape should be checked against the installed `@supabase/supabase-js` version once added.
4. `PLOVER_WEBSITE_URL`/pricing path is a placeholder until the real production URL is confirmed.
5. Monday-start week boundary is an assumption (no product spec pins this down) — confirm with the user/product owner.
