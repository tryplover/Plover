# Launch readiness Plan

> **For agentic workers:** small, independent fixes before the first Chrome Web Store upload. Each task is its own PR off `main`. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Close the gaps between the extension on `main` and a store submission. The waitlist gate is dropped (launch opens within days), so sign-up stays open behind required Supabase sign-in.

**Already on `main` (do not redo):** optional site access (`optional_host_permissions`, runtime-registered buddy script, per-site grants from the popup, plain-block fallback without host access), the welcome page opened on install (sign in, privacy, site access), `tabs` replaced by `activeTab`, icons, the Oct 16 buddy art.

## Global Constraints

- `pnpm typecheck && pnpm lint && pnpm test && pnpm build` green from the repo root.
- No new dependencies, no new permissions, no new network destinations.
- Pages talk to the worker only via `@/shared/messages` (`sendCommand`); never import `worker.ts` files from `ui/**` or entrypoints.
- No comments unless the WHY is non-obvious. TDD pure logic in `features/`; skip TDD for UI scaffolding.

## Task 1: Launch metadata (orchestrator)

- [ ] `extension/package.json` version `0.1.0` (WXT copies it to the manifest).
- [ ] `extension/manifest.config.ts` description: `"A cute work buddy that keeps you company while you focus: task steps, a Pomodoro timer and site blocking."` (≤132 chars, store limit).
- [ ] Spec, README, CLAUDE.md: launch is no longer waitlist-only; sign-in stays required, sign-up is open.

## Task 2: Show Supabase's reason when Google sign-in fails

`registerHandler("auth/google")` in `extension/src/features/auth/worker.ts` only looks for `?code=` in the URL `launchWebAuthFlow` returns, so any provider/Supabase failure is reported as "Sign-in was cancelled".

- [ ] Extract a pure helper (same file or `features/auth/redirect.ts`): given the returned URL string (or `undefined`), return `{ code }`, `{ error }` or `{ cancelled: true }`. Supabase reports failures as `error` / `error_description` in the query string **or** the URL fragment (`#error=...&error_description=...`); prefer `error_description`, fall back to `error`. `+` in the description decodes to a space (`URLSearchParams` does this).
- [ ] TDD it in `extension/tests/features/auth/` (code in query; error_description in query; error_description in fragment; only `error`; undefined → cancelled; URL with neither → cancelled).
- [ ] Use it in the handler: error → `{ ok: false, error }`; cancelled → existing "Sign-in was cancelled".

## Task 3: Finish the welcome flow (`extension/src/entrypoints/welcome/`)

Keep the existing Sign in, Site access and Privacy sections and their logic. Add, in this order on the page:

1. **Header:** the `Buddy` component (`@/ui/components/Buddy`) in `idle` state above "Welcome to Plover", then one line: "Plover is a small work buddy for your browser."
2. **Sign in** (existing).
3. **What Plover does** (new): a short list —
   - "Break a task into steps. Plover suggests them and you can edit every one."
   - "Run a Pomodoro timer. At the end of each work block, tick off the step you finished."
   - "Turn on Focus mode to block your distracting sites until the block ends."
   - "The buddy sits in a corner of the sites you allow, and never reads the page."
4. **Site access** (existing).
5. **Google Calendar (optional)** (new): "See your next event so a focus block doesn't run into a meeting. Plover only reads your calendar." A Connect button sending `{ type: "calendar/connect" }` via `sendCommand` (copy the pattern in `entrypoints/options/main.tsx` `toggleCalendar`, including the error `role="alert"`). When `local.calendarConnected` show "Calendar connected." instead. When `local.needsSignIn`, disable the button and show "Sign in first."
6. **Pin Plover** (new): "Click the puzzle-piece icon in Chrome's toolbar, then the pin next to Plover. You can also press Alt+Shift+P to open it."
7. **Privacy** (existing), last.

- [ ] Add matching minimal styles to `welcome.css` (list spacing, centred header buddy); reuse existing classes otherwise.
- [ ] Manual check: `pnpm build` succeeds.

## Task 4: Chrome Web Store launch checklist (orchestrator)

- [ ] `docs/launch/chrome-web-store.md`: listing copy, single-purpose statement, a justification per permission, data-use disclosures matching the privacy policy, production build/env steps, extension ID + redirect URL setup, Google OAuth verification for `calendar.readonly`, and the submit steps.
