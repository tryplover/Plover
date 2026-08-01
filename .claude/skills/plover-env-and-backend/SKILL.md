---
name: plover-env-and-backend
description: Use when OAuth uses "mock-client-id" fallback instead of real GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET from app/.env, when goal decomposition fails with "Server responded with status 404" or the backend hits the wrong local port, when a browser tab opens to "http://localhost:3000/signup" with connection refused instead of the configured PLOVER_BACKEND_URL, when Google sign-in works in dev but not in a packaged/production build (browser authorizes but nothing routes back, the plover:// deep link does nothing, no "Open Plover?" prompt) and goal:propose/authedFetch then throws "UnauthorizedError: no plover token — user must sign in", or when adding/moving env var reads in app/src/main or electron.vite.config.ts.
---

# Plover env loading and backend URL wiring

## Overview
Covers two related footguns: how main-process secrets get loaded from `app/.env`, and how `PLOVER_BACKEND_URL` can get silently baked to the wrong value at Vite build time.

## Quick reference
| Symptom / error | Fix |
|---|---|
| OAuth falls back to `mock-client-id`; `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` not picked up from `app/.env` | Load env via a dedicated first-import side-effect module, not a body-level call in `index.ts` |
| `goals:decompose` fails: `Goal decomposition failed: Server responded with status 404` | Port 3000 is occupied by another local service; move the backend to another port |
| Clicking "Continue with Google" opens `http://localhost:3000/signup?...` (connection refused) instead of the real `app/.env` `PLOVER_BACKEND_URL` | Vite `define` defaulted the value to the literal `'http://localhost:3000'`, always-truthy — default it to `''` instead |
| Google sign-in works in dev but not in the packaged app: browser authorizes, then nothing happens (no `plover://` redirect back), and `goal:propose`/`authedFetch` throws `UnauthorizedError: no plover token — user must sign in` | Register the `plover` URL scheme in the electron-builder `build.protocols` config so the packaged app's Info.plist gets `CFBundleURLTypes` — `setAsDefaultProtocolClient` alone only works in dev |

## Details

### `load-env.ts` must be the first import
**Symptom:** Putting `process.loadEnvFile()` in the body of `app/src/main/index.ts` did not make `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` from `app/.env` available — OAuth still used the `mock-client-id` fallback.

**Root cause:** `google-auth.ts` reads `process.env.GOOGLE_CLIENT_ID` at module-evaluation time, and ES module imports (`index.ts` → `ipc.ts` → `google-auth.ts`) are hoisted and evaluated *before* any statement in the `index.ts` body. A body-level `process.loadEnvFile()` runs too late. (`gemini.ts` is unaffected because it reads the key lazily inside `getGeminiClient()`.)

**Fix:** Load env in a dedicated side-effect module `app/src/main/load-env.ts` (guarded `try { process.loadEnvFile() } catch {}`) and import it as the **first** import in `index.ts`:
```ts
import './load-env.js';
```
ESM evaluates imports in source order, so the env file loads before `google-auth.ts` is evaluated. Secrets live in `app/.env` (gitignored); see `docs/RUNNING.md`.

### Port 3000 collisions break goal decomposition
**Symptom:** Invoking `goals:decompose` fails with `Goal decomposition failed: Server responded with status 404`.

**Root cause:** The backend proxy server defaults to port `3000`. If another local service (e.g. a Next.js dev server) already occupies port `3000`, requests from the Electron client to `http://localhost:3000/api/decompose` hit the other service instead, returning 404.

**Fix:** Create `server/.env` with `PORT=3001` (or another unused port), and create `app/.env` with `PLOVER_BACKEND_URL=http://localhost:3001`. Restart both processes so they load their respective env files.

### `PLOVER_BACKEND_URL` silently overridden by a Vite build-time default
**Symptom:** Clicking "Continue with Google" on the signup screen in `pnpm dev` opened a browser tab to `http://localhost:3000/signup?state=…` (connection refused) instead of the Cloud Run URL set in `app/.env`.

**Root cause:** `electron.vite.config.ts` had:
```ts
'import.meta.env.PLOVER_BACKEND_URL': JSON.stringify(process.env.PLOVER_BACKEND_URL ?? 'http://localhost:3000')
```
`process.env.PLOVER_BACKEND_URL` is unset at Vite build time (only `app/.env` sets it, loaded at runtime by `load-env.ts` in the main process). So Vite baked the literal `'http://localhost:3000'` into every consumer. Consumers (`signup-flow.ts`, `authed-fetch.ts`) check `import.meta.env.PLOVER_BACKEND_URL` first and only fall through to `process.env.PLOVER_BACKEND_URL` if the Vite value is falsy — the bake made it always-truthy, so the runtime `app/.env` value never won.

**Fix:** Default the Vite define to an empty string instead:
```ts
'import.meta.env.PLOVER_BACKEND_URL': JSON.stringify(process.env.PLOVER_BACKEND_URL ?? '')
```
If unset at build time, `if (fromVite)` in consumers is falsy and they correctly fall through to the runtime `process.env` value. Packaged builds still work because CI sets `PLOVER_BACKEND_URL` in the release workflow env before `pnpm package`, so Vite bakes the real value there.

### `plover://` deep-link sign-in works in dev but not in the packaged app
**Symptom:** In a production/packaged build, "Continue with Google" opens the browser and OAuth completes, but nothing routes back to the app (no "Open Plover?" prompt, app never comes forward). No plover token is ever stored, so `goal:propose` (overlay SetupFlow → StepBreakdown) — and any `authedFetch` call — throws `UnauthorizedError: no plover token — user must sign in`. Works fine in `pnpm dev`.

**Root cause:** The plover token is set **only** by `completeSignup()`, which fires when the backend redirects to `plover://…?token=…`. The main-process runtime wiring is correct (`app.setAsDefaultProtocolClient('plover')`, `open-url` on macOS, `second-instance` argv scan on Win/Linux, cold-start URL buffering flushed on `whenReady` — all in `app/src/main/index.ts`). But `setAsDefaultProtocolClient` only registers the scheme dynamically for the **dev** Electron binary. A packaged macOS app needs the scheme declared in its `Info.plist` (`CFBundleURLTypes`); without it, macOS can't route `plover://` back to the app, so `completeSignup` never runs. The electron-builder `build` config in `app/package.json` was missing a `protocols` entry.

Note: Google (deep-link) sign-in and email/password (Supabase) sign-in are **separate** systems — only the `plover://` flow sets the plover token that `authedFetch` requires. Email/password (`auth:signInWithPassword`) stores a Supabase session and does NOT produce a plover token.

**Fix:** Add `protocols` to `build` in `app/package.json` so electron-builder writes `CFBundleURLTypes` (macOS) / registers the scheme (Windows):
```json
"protocols": [
  { "name": "Plover Protocol", "schemes": ["plover"] }
]
```
Verify by rebuilding and confirming the packaged `Info.plist` contains a `CFBundleURLTypes` entry for `plover`, then testing Google sign-in on the **installed** app (a fresh `pnpm dev` run won't exercise this — the dev binary registers the scheme dynamically regardless).
