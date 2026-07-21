# Remove hardcoded values (Tier 1 — user-visible prod issues)

Small focused cleanup to remove hardcoded values that show up in production on load. Tier-2/3 (magic numbers, i18n) deferred.

## Changes

### 1. Onboarding fake goal seed (`app/src/renderer/main/pages/Onboarding.tsx`)

Replace the hardcoded 5-subtask thesis seed with a real call to `window.api.proposeGoal(appName)` (already used by the overlay `SetupFlow`) and `commitGoal(plan)`.

- Line 24: `useState('Finish the methods section of my thesis')` → `useState('')`.
- Line 20-23: `selectedUsecases` initial `['Essays & papers', 'Digital projects']` → `[]` (no pre-checks).
- Add state `plan: ProposedPlan | null` and `planLoading / planError`.
- Step 5 "Break into steps →" button: on click, call `window.api.proposeGoal(appName.trim())`, store the result in `plan`, advance to step 6.
- Step 6: render `plan.subtasks` instead of hardcoded 5 lines. Show "Asking Gemini…" while `planLoading`, show error state on failure with a "Try again" button.
- Step 9 `handleFinish`: replace the whole hardcoded `goal + tasks + scheduledSlots` block with `await window.api.commitGoal(plan)`. Guard with `if (!plan) return;`.
- Steps 7 and 8 mockup rows/pill stay as-is (user chose to keep them as decorative illustrations).

### 2. Env fail-fast in packaged builds

Add a helper `resolveRequiredEnv(name, opts)` that:
- Returns `process.env[name]` if defined and non-empty.
- If `app.isPackaged`, throws at startup with a clear message.
- If dev (`!app.isPackaged`), returns the provided dev fallback (unchanged behavior).

Apply to:
- `app/src/main/http/authed-fetch.ts:11` — `PLOVER_BACKEND_URL` (dev fallback: `http://localhost:3000`).
- `app/src/main/auth/signup-flow.ts:24` — same.
- `app/src/main/sync/google-auth.ts:9-10` — `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` (dev fallbacks: `mock-client-id` / `mock-client-secret`).
- `electron.vite.config.ts` already defaults `PLOVER_BACKEND_URL` to `''` at build time (per lesson-learned 2026-07-19) — no change needed there.

New file: `app/src/main/config/env.ts` exports `resolveRequiredEnv(name, {devFallback})`. Import from `electron` for `app.isPackaged`. Throws in packaged builds if env missing.

### 3. Companion default progress (`app/src/renderer/companion/useCompanionState.ts:18`)

`progress: 0.65` → `progress: 0`. The IPC-populated state overwrites this once it arrives; there's no reason to flash fake 65% first.

### 4. Onboarding demo MP4 (`app/src/renderer/main/pages/Onboarding.tsx:290`)

Delete the external `commondatastorage.googleapis.com/…/ForBiggerBlazes.mp4` video element. Replace the `.plover-onboarding__video-container` wrapper's content with a static logo/placeholder (or leave the container empty — the surrounding chrome already looks like a mockup).

### 5. Version string (`app/src/renderer/App.tsx:73`)

`"Plover v1.0.0"` → read from injected build-time constant. Add to `app/electron.vite.config.ts` renderer `define`:
```ts
'import.meta.env.PLOVER_VERSION': JSON.stringify(require('./package.json').version),
```
In `App.tsx`: `Plover v{import.meta.env.PLOVER_VERSION}`. Also bump `app/package.json` `version` from `0.0.0` to `0.1.0` or whatever is current for the hackathon build.

## Files touched

- `app/src/renderer/main/pages/Onboarding.tsx` (biggest change: ~40 line delta)
- `app/src/main/http/authed-fetch.ts`
- `app/src/main/auth/signup-flow.ts`
- `app/src/main/sync/google-auth.ts`
- `app/src/main/config/env.ts` (new)
- `app/electron.vite.config.ts`
- `app/src/renderer/companion/useCompanionState.ts`
- `app/src/renderer/App.tsx`
- `app/package.json` (version bump)

## Verify

`pnpm typecheck && pnpm lint && pnpm test` from repo root.
Manual: `pnpm dev`, run through onboarding — Step 5 field should be empty; typing "Read a book about the Roman Empire" should show Gemini-generated subtasks on step 6; "Start tracking" on step 9 should insert the real goal. Sidebar version should not read `v1.0.0`.
