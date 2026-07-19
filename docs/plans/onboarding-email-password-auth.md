# Native email/password auth in onboarding

## Context

Onboarding currently offers only Google sign-in (via Supabase OAuth,
`window.api.auth.signIn()`) at two points: the welcome screen's "Already have
an account? Sign in" link (skips the wizard entirely) and the final "Trial
close" step's "Start tracking →" button (creates the account, then saves the
starter goal/tasks locally). The website (tryplover.com) offers both Google
and email/password against the same Supabase project. This adds the
email/password path natively in the app — no browser redirect, no website
changes needed — reusing the existing Supabase client/session infra from
`app/src/main/auth/supabase-auth.ts` and `supabase-client.ts` (see
`docs/plans/link-supabase-account.md` for that prior work).

Built on a fresh branch off `origin/main` (not `fix/onboarding-issues`, which
is mid-flight on unrelated onboarding redesign work) per explicit user
request.

## Main-process changes

### `app/src/main/auth/supabase-auth.ts`
Add two exports alongside the existing OAuth `signIn`:

```ts
export async function signUp(
  email: string,
  password: string,
): Promise<{ needsEmailConfirmation: boolean }> {
  const { data, error } = await getSupabaseClient().auth.signUp({ email, password });
  if (error) throw new SupabaseAuthenticationError(error.message);
  return { needsEmailConfirmation: !data.session };
}

export async function signInWithPassword(email: string, password: string): Promise<void> {
  const { error } = await getSupabaseClient().auth.signInWithPassword({ email, password });
  if (error) throw new SupabaseAuthenticationError(error.message);
}
```

No loopback HTTP server needed for these — direct request/response, unlike
the OAuth redirect dance. `needsEmailConfirmation` covers Supabase projects
with email confirmation enabled (session is null until the user clicks the
confirmation link); the renderer shows a "check your email" message in that
case instead of treating it as fully signed in.

### `app/src/main/ipc.ts`
Add `auth:signUp` and `auth:signInWithPassword` handlers next to the existing
`auth:signIn`, following the same shape (persist `supabaseUserId`/
`supabaseUserEmail` via `settingsRepo.update`, broadcast `auth:status-changed`,
try/catch-log-rethrow):

- `auth:signInWithPassword(email, password)` — call `supabaseAuth.signInWithPassword`,
  then `getCurrentUser()`, persist + broadcast + return `{ signedIn: true, email }`
  exactly like `auth:signIn` does today.
- `auth:signUp(email, password)` — call `supabaseAuth.signUp`; if
  `needsEmailConfirmation`, return `{ signedIn: false, email, needsEmailConfirmation: true }`
  without touching settings/broadcast (no session exists yet). Otherwise same
  persist+broadcast+return as signIn, with `needsEmailConfirmation: false`.

### `app/src/preload/index.ts` + `app/src/renderer/global.d.ts`
Extend the `auth` block (both the preload `PloverApi` type + implementation,
and the renderer-only mirror in `global.d.ts`) with:
```ts
signInWithPassword: (email: string, password: string) => Promise<{ signedIn: boolean; email: string | null }>;
signUp: (email: string, password: string) => Promise<{ signedIn: boolean; email: string | null; needsEmailConfirmation: boolean }>;
```

## Renderer changes

### `app/src/renderer/main/pages/Onboarding.tsx`
Add a local `AuthPanel({ mode: 'signin' | 'signup', onSuccess })` component
(defined in this file, no new file — matches the file's existing
everything-in-one-page style) that renders:
- "Continue with Google" button (reuses the already-defined-but-unused
  `.plover-onboarding__btn-google` CSS class) → calls `window.api.auth.signIn()`.
- An "or" divider.
- Email + password inputs + submit button → calls
  `window.api.auth.signUp(email, password)` (mode `signup`) or
  `window.api.auth.signInWithPassword(email, password)` (mode `signin`).
- Local status state (idle/submitting/opened-browser/check-email/error) drives
  button disabled state + inline messaging, mirroring the existing
  `authState` pattern already used elsewhere in this file.
- On `needsEmailConfirmation`, shows "check your email" instead of calling
  `onSuccess`.

Wire it in at both points:
- **Welcome screen**: replace the "Already have an account? Sign in" button's
  immediate `handleSignIn` call with a toggle (`showSignInPanel` state) that
  reveals `<AuthPanel mode="signin" onSuccess={...} />` in place of the link.
  `onSuccess` does what `handleSignIn` does today: set
  `localStorage.plover_onboarding_completed` + `onComplete()`.
- **Trial-close (step 9) / Done step**: replace the "Start tracking →" button
  with `<AuthPanel mode="signup" onSuccess={completeOnboardingWithGoal} />`,
  where `completeOnboardingWithGoal` is `handleFinish`'s existing goal/task
  save logic, extracted so it runs after auth succeeds instead of being
  interleaved with the auth call itself.

Remove `handleSignIn`, `handleFinish`'s auth-call lines, `authState`,
`handleCancelSignIn` if nothing else references them after the refactor —
`AuthPanel` owns its own status state now.

### `app/src/renderer/main/pages/Onboarding.css`
Add `.plover-onboarding__auth-panel`, `.plover-onboarding__auth-divider`,
`.plover-onboarding__auth-form`, `.plover-onboarding__auth-input`,
`.plover-onboarding__auth-submit` (or similar), matching the existing
pill/rounded-corner/serif-adjacent visual language already in this file
(see `.plover-onboarding__btn-google`, `.plover-onboarding__mockup-input` for
color/radius reference points).

## Tests to add/extend

- `app/tests/main/auth/supabase-auth.test.ts` — add `describe('signUp', ...)`
  and `describe('signInWithPassword', ...)` blocks mirroring the existing
  `mockSupabaseAuth` hoisted-mock pattern: success, Supabase error →
  `SupabaseAuthenticationError`, and (for `signUp`) the `needsEmailConfirmation`
  true/false branches (`data.session` present vs `null`).
- `app/tests/main/ipc.test.ts` — extend the existing
  `describe('auth:signIn, auth:signOut, auth:getStatus', ...)` block (or add a
  sibling one) with cases for `auth:signInWithPassword` and `auth:signUp`,
  following the existing `getHandler(channel)` helper pattern.
- `app/tests/renderer/main/pages/Onboarding.test.tsx` (if it exists — check
  before assuming) — cover the new toggle-to-reveal-panel behavior and that
  submitting the password form calls the right `window.api.auth` method.

## Verification

`pnpm typecheck && pnpm lint && pnpm test` from repo root, green, before
calling this done.

## Explicitly not touching

`signup-flow.ts`, `plover-token.ts`, `with-auth-retry.ts`, `authed-fetch.ts`,
`google-auth.ts` (Calendar OAuth) — the plover-server Gemini-auth flow keeps
working exactly as today; see the prior conversation's caveat that fully
removing it requires plover-server-side changes outside this repo. Settings.tsx's
existing "Plover Account" Google-only row is untouched by this change (out of
scope — could get an email/password option too as a follow-up, not asked for
here).
