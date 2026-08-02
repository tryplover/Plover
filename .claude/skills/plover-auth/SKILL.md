---
name: plover-auth
description: Use when a user who is signed in (Google or email/password, via the in-app Sign In / Account UI) still hits "UnauthorizedError: not signed in — user must sign in" or "no plover token" when creating a goal/task, when deciding where new sign-in/sign-up UI should live, or when touching app/src/main/auth/*, app/src/main/http/authed-fetch.ts, or the plover-server auth middleware.
---

# Plover auth: unified on Supabase

## Overview
Plover used to have **two disconnected auth systems**: a Supabase session (Google
OAuth or email/password, via `supabase-auth.ts`) that powered the visible "Sign in to
Plover" UI, and a separate opaque "plover token" (Firestore-backed, obtained by
opening `plover-server`'s own `/signup` page + a `plover://` deep-link handshake) that
the backend actually required for every Gemini call. Signing in via Supabase never
produced a plover token, so users who "signed in" successfully still got
`UnauthorizedError: no plover token — user must sign in` the first time they tried to
create a goal — and there was no way to create a *new* account from inside the app at
all (only a Sign In form existed post-onboarding; the account you could create only
worked for the cosmetic Supabase session, not the Gemini-gating token).

This was fixed by ripping out the Firestore/`plover://` token system entirely. Auth is
now unified end-to-end on Supabase: the app sends the current Supabase session's
access token as `Authorization: Bearer <token>` on every backend call, and
`plover-server`'s middleware verifies it directly via `supabase.auth.getUser()` —
no separate token, no deep link, no keychain-stored `plover_token`.

## Quick reference
| Symptom / error | Fix |
|---|---|
| Signed in via Google/email, but goal creation throws `UnauthorizedError: not signed in — user must sign in` or `no plover token` | Check whether `plover-server`'s deployed auth middleware has been updated to verify Supabase tokens (`src/auth/middleware.ts` in the separate `tryplover/plover-server` repo). If it still expects the old `X-Plover-Auth-Token` header, every request 401s regardless of Supabase sign-in state. |
| Need a "not signed in, please sign in" UI on any new call site that hits `authedFetch`/`decomposeGoal` | Import `isNotSignedInError` from `app/src/shared/auth-errors.ts` and render the shared `AuthPanel` (`app/src/renderer/components/AuthPanel/AuthPanel.tsx`) inline on catch — see `StepBreakdown.tsx` for the pattern (retry the original call from `AuthPanel`'s `onSuccess`). |
| Tempted to add a second/parallel sign-in mechanism (deep link, separate token, separate OAuth client) | Don't — Supabase is the single identity system across the Electron app, `plover-website`, and `plover-server`. Add to `supabase-auth.ts` / reuse `AuthPanel`, not a new flow. |
| Adding a new backend endpoint that needs the caller's identity | It arrives as `req.userId` (a Supabase UUID) once `authMiddleware` runs — same id space as `plover-website`'s `profiles.id` / Stripe `client_reference_id`. |

## Details

### The two-system split (historical, now removed)
**Symptom:** A user could complete the in-app "Sign in to Plover" flow (Google OAuth
or email/password, both via Supabase) and still get `no plover token — user must sign
in` the moment they tried to decompose a goal, with no recovery path in the UI.

**Root cause:** `app/src/main/ipc/goals.ts`'s `goal:propose` handler (the overlay
quick-add / `SetupFlow` "window" variant's only goal-creation path) called
`decomposeGoal` directly with no fallback. `decomposeGoal` → `authedFetch` required a
**plover token**, a completely different credential from the Supabase session:
obtained only via `app/src/main/auth/signup-flow.ts`'s `startSignup()`, which opened
`${PLOVER_BACKEND_URL}/signup` (the `plover-server` Cloud Run backend's own bare
"Continue with Google" page — not `trypilover.com`) in the external browser and
waited for a `plover://auth?token=…&state=…` deep link, storing the resulting opaque
token in the OS keychain via `plover-token.ts`. Signing in through the visible
Supabase UI never touched any of this.

Compounding it: `AccountModal.tsx` (the only auth UI reachable after onboarding, from
Settings → Account) had **only** a Sign In form — no Sign Up — so even discovering
the disconnect left no in-app path to create a fresh account; the only way to create
one was the website.

**Fix:** Removed entirely — see below.

### Current architecture
- **App side:** `app/src/main/auth/supabase-auth.ts` owns the Supabase session
  (`signIn`/`signInWithPassword`/`signUp`/`signOut`/`getAccessToken`).
  `app/src/main/http/authed-fetch.ts`'s `authedFetch` reads `getAccessToken()` and
  sends it as `Authorization: Bearer <token>`; throws `UnauthorizedError` (message
  includes the `NOT_SIGNED_IN_MESSAGE` sentinel from `app/src/shared/auth-errors.ts`)
  when there's no session or the backend 401s. There is no local token to clear on
  401 — `startAutoRefresh()` (called at boot) keeps the Supabase session itself
  fresh.
- **Shared UI:** `app/src/renderer/components/AuthPanel/AuthPanel.tsx` is the single
  Google-button + email/password + signin/signup-mode-toggle component, used by
  `Onboarding.tsx`, `AccountModal.tsx` (now has a working sign-up toggle), and inline
  in `StepBreakdown.tsx`'s not-signed-in branch (detected via `isNotSignedInError`,
  retries the original `proposeGoal` call on `AuthPanel`'s `onSuccess`).
- **Backend (`tryplover/plover-server`, separate repo):** `src/auth/middleware.ts`
  verifies the `Authorization: Bearer` token via a service-role Supabase client's
  `auth.getUser()` (see `src/auth/supabase-client.ts` there) and attaches
  `req.userId` — a Supabase UUID, the same id space `plover-website` already uses for
  `profiles`/Stripe. The old `/signup`, `/oauth/callback`, and Firestore
  `users`/`tokens` collections are gone; `rate_limits` (keyed by `req.userId`) is
  unaffected by the swap.
- **Removed for good:** `app/src/main/auth/plover-token.ts`, `signup-flow.ts`,
  `with-auth-retry.ts`; the `plover://` protocol registration and `open-url`/
  `second-instance` handling in `app/src/main/index.ts`; the `signup:start` IPC
  handler.

### If you see the symptom again after this fix
Since the fix spans two repos, the most likely cause is sequencing: the app was
updated to send `Authorization: Bearer`, but the deployed `plover-server` Cloud Run
instance still runs the old middleware (expects `X-Plover-Auth-Token`, doesn't know
about Supabase) — every call 401s until that backend PR is merged and deployed with
`SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` configured in its environment/Secret
Manager. Check which side is stale before assuming the app-side fix regressed.
