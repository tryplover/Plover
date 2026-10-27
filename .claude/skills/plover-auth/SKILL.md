---
name: plover-auth
description: Use when a signed-in user still gets 401 / "not signed in" from plover-server, when deciding where new sign-in UI should live, when touching extension/src/features/auth/worker.ts or extension/src/features/auth/*, or the plover-server auth middleware.
---

# Plover auth: unified on Supabase

## Overview

Auth is unified end-to-end on Supabase. The extension sends the current Supabase
session's access token as `Authorization: Bearer <token>` on every backend call, and
`plover-server`'s middleware verifies it directly via `supabase.auth.getUser()`. There
is no separate Plover token, deep link or `X-Plover-Auth-Token` header (the old
Firestore token system was removed).

## Quick reference

| Symptom / error                                                                            | Fix                                                                                                                                                                                                                                                                                                             |
| ------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Signed in via Google/email but calls to `plover-server` 401                                | Check whether the deployed `plover-server` middleware verifies Supabase tokens (`src/auth/middleware.ts` in the separate `tryplover/plover-server` repo) and has `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` configured. If it still expects `X-Plover-Auth-Token`, every request 401s regardless of the client. |
| Tempted to add a second/parallel sign-in mechanism (separate token, separate OAuth client) | Don't. Supabase is the single identity system across the extension, `plover-website` and `plover-server`. Extend `extension/src/features/auth/` instead.                                                                                                                                                             |
| Adding a backend endpoint that needs the caller's identity                                 | It arrives as `req.userId` (a Supabase UUID) once `authMiddleware` runs, the same id space as `plover-website`'s `profiles.id` / Stripe `client_reference_id`.                                                                                                                                                  |
| `launchWebAuthFlow` sign-in or Calendar auth fails with a redirect mismatch                | The redirect `https://<extension-id>.chromiumapp.org/` must be registered in Supabase (Redirect URLs) and on the Google OAuth **Web application** client; see `docs/RUNNING.md` section "Chrome extension".                                                                                                     |

## Details

### If you see a 401 after the client sends a Bearer token

The fix spans two repos, so the most likely cause is sequencing: the deployed
`plover-server` Cloud Run instance runs an older middleware, or lacks Supabase
credentials in its environment/Secret Manager. Check which side is stale before
assuming the client regressed. Ops recipes live in the `plover-server-ops` skill.

### Backend identity

`plover-server` attaches `req.userId` after verifying the token with a service-role
Supabase client. `rate_limits` is keyed by `req.userId`; a 429 means the per-user daily
quota is exhausted, not an auth failure.
