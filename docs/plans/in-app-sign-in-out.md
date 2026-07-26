# In-app Plover Account sign-in / sign-out

## Context

The user reported that Plover's account sign-in only really works during
onboarding, and breaks down once inside the main app. Investigation found:

- There are **two unrelated auth systems** in this codebase:
  1. **Supabase account auth** (`app/src/main/auth/supabase-auth.ts` +
     `auth:signIn` / `auth:signInWithPassword` / `auth:signUp` / `auth:signOut`
     / `auth:getStatus` IPC in `app/src/main/ipc.ts:122-194`). This is the
     "Plover Account" identity shown in Settings and the sidebar.
  2. **Plover backend token auth** (`app/src/main/auth/signup-flow.ts` +
     `plover-token.ts`, invoked via `withAuthRetry`). This authorizes calls to
     the backend Gemini proxy and is unrelated to account identity. **Out of
     scope for this work** (confirmed with user) — it can silently open a
     browser tab when a backend call 401s, which is a separate, deeper
     question or later fix.
- Within Supabase account auth, **all the IPC/preload plumbing already works**
  for email+password sign-in and sign-up
  (`window.api.auth.signInWithPassword` / `signUp`, preload
  `app/src/preload/index.ts:127-180`) — but **no UI in the main app calls
  them**. `Settings.tsx` only wires up Google sign-in
  (`window.api.auth.signIn()`) and sign-out. There's no in-app modal
  equivalent to the website's "Sign In" modal the user showed (email,
  password, divider, "Sign In with Google").
- `app/src/renderer/main/pages/Onboarding.tsx:31-159` has a **fully working
  reference implementation** of this exact flow: `AuthPanel`, a local
  component with a `mode: 'signin' | 'signup'` prop, handling Google OAuth
  (`window.api.auth.signIn()`), email/password submit
  (`signInWithPassword`/`signUp`), a small status state machine (idle /
  submitting / opened-browser / check-email / error), and cancel-while-waiting
  for the Google browser flow. This is the pattern to copy the *logic* from —
  it's proven and already used in production onboarding. Don't touch
  `Onboarding.tsx` itself.
- **Bug found**: `App.tsx` (`app/src/renderer/App.tsx:38-49`) fetches
  `auth:getStatus` once on mount to populate the sidebar's `accountEmail`, but
  never subscribes to the `auth:status-changed` broadcast the way
  `Settings.tsx` does (`Settings.tsx:104`). So today, signing in/out via
  Settings does not update the sidebar until the app is reloaded. This is part
  of "runs into issues again" and must be fixed regardless of the new modal.
- Sign-out is already safe: `auth:signOut` (`ipc.ts:176-189`) only clears
  `supabaseUserId`/`supabaseUserEmail` in `settingsRepo` and calls
  `supabaseAuth.signOut()` — it never touches Goals/Tasks/Store. No changes
  needed there; the new UI just needs to call the existing IPC.

## Goal

Add a single, always-reachable entry point in the sidebar (the `? Not signed
in` / avatar+email row above Settings, `App.tsx:95-100`) that:
- When signed out: opens a modal styled like the website's Sign In modal —
  email + password fields, "Sign In" button, "OR" divider, "Sign In with
  Google" button — but **simplified**: no "Don't have an account? Sign Up"
  link (per user: users already have an account from onboarding).
- When signed in: clicking the same row lets the user sign out, without
  touching local goals/tasks/settings data.
- The sidebar and Settings page both reflect auth state changes immediately,
  from either surface, via the existing `auth:status-changed` broadcast.

Non-goals: touching `signup-flow.ts`/backend token auth, changing
`Onboarding.tsx`, adding account creation/sign-up UI outside onboarding.

## File-by-file changes

### 1. New: `app/src/renderer/components/AccountModal.tsx`

A new component, modeled directly on `AuthPanel` in `Onboarding.tsx` but:
- Fixed to sign-in only — no `mode` prop, no sign-up toggle, no
  "check-email" confirmation state (that's a sign-up-only concern).
- Takes props: `status: { signedIn: boolean; email: string | null }`,
  `onClose: () => void`, `onStatusChange: (status) => void`.
- Two render branches:
  - **Signed out**: reuse the exact state machine from `AuthPanel`
    (idle/submitting/opened-browser/error) for email+password
    (`window.api.auth.signInWithPassword`) and Google
    (`window.api.auth.signIn()`, with the same cancel-while-waiting
    affordance). On success, call `onStatusChange` then `onClose`.
  - **Signed in**: show "Signed in as {email}" and a single "Sign out"
    button calling `window.api.auth.signOut()`, then `onStatusChange` +
    `onClose`.
- Markup wrapped in the existing modal shell classes already used in
  `Home.tsx:192-206` (`plover-modal-backdrop`, `plover-modal-content`,
  `plover-modal-close`) so it matches the app's established modal pattern,
  not onboarding's dark full-screen styling.
- Reuse the existing `.plover-input` class (`index.css:1124`) for the email
  and password fields, and the existing `Button` component
  (`components/Button.tsx`) for actions, for visual consistency with the
  rest of the app shell (light theme).
- Add a small amount of new CSS in `index.css` only for what doesn't already
  exist: the "OR" divider and inline error/status text. Keep it minimal —
  follow the pattern of existing small utility classes rather than inventing
  a new system.

### 2. `app/src/renderer/App.tsx`

- Import the new `AccountModal`.
- Add `const [showAccountModal, setShowAccountModal] = useState(false)`.
- Make the profile row (`App.tsx:95-100`) clickable: wrap in a `<button
  type="button">` (or add `onClick`/`role="button"`/`tabIndex={0}` +
  keydown handling if kept as a `div`) that opens the modal on click.
- Fix the live-update bug: alongside the existing one-shot
  `auth.getStatus()` fetch (`App.tsx:38-49`), subscribe to
  `window.api.on('auth:status-changed', ...)` the same way `Settings.tsx:104`
  does, updating `accountEmail`, with cleanup (`unsubscribe`) on unmount.
- Render `<AccountModal>` conditionally when `showAccountModal` is true,
  passing `{ signedIn: !!accountEmail, email: accountEmail }` as `status`,
  `onClose={() => setShowAccountModal(false)}`, and `onStatusChange`
  updating `accountEmail` (belt-and-suspenders alongside the broadcast
  listener, so the sidebar updates instantly even before the broadcast
  round-trip).

### 3. `app/src/renderer/main/pages/Settings.tsx`

No functional changes expected — it already listens to
`auth:status-changed` (`Settings.tsx:104`) and already calls
`signIn()`/`signOut()`. Verify after the change that a sign-in/out
triggered from the new sidebar modal is correctly reflected on the Settings
page too (shared broadcast), and vice versa. If for some reason the
existing Settings Google button and the new modal race or duplicate a
broadcast in a way that causes flicker, fix minimally — don't restructure
Settings' auth section.

## Verification

1. `pnpm typecheck && pnpm lint && pnpm test` from repo root — must be green.
2. Code-level review (per this repo's lesson that Electron GUIs can't be
   visually verified via the Bash/PowerShell tool):
   - Confirm `AccountModal` only calls `window.api.auth.*` — no direct
     Store/Goals/Tasks access — so sign-out cannot affect local task data.
   - Confirm `App.tsx`'s new `auth:status-changed` subscription is cleaned
     up on unmount (no leaked listener, matching the `Settings.tsx` pattern
     and the "EventEmitter" lesson in `CLAUDE.md`).
   - Confirm the "Sign Up" link/copy is absent from the new modal.
3. Ask the user to run `pnpm dev` and manually confirm: clicking the sidebar
   row when signed out opens the modal; email+password and Google sign-in
   both work and close the modal; the sidebar updates immediately; clicking
   the row when signed in offers sign-out; after sign-out, existing
   goals/tasks in the Today/Home view are untouched.

## Delegation

Per `CLAUDE.md`, implement via a subagent rather than directly in the
orchestrating session. This is a single cohesive UI change across 2 files
(one new, one edited) with a proven reference implementation to copy from —
default risk is low, but it involves coordinating React state across
components and matching an existing visual system carefully, so use a
Sonnet-level agent rather than Haiku.
