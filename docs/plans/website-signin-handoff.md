# Website sign-in handoff and open sign-up

## Goal

People sign up and sign in on tryplover.com. The extension gets its own Supabase session from the website, with no second sign-in. The website stops showing a waitlist and points to the Chrome Web Store.

Decisions (2026-11-08, product owner):

- Store extension ID: `mljdeimnoodcnlbdkcojejgmgbgjcand`. Listing: `https://chromewebstore.google.com/detail/mljdeimnoodcnlbdkcojejgmgbgjcand` (in review; not live yet).
- Install flow: keep the six-step welcome walkthrough. Step 2 ("Sign in") gets a main button **Sign in on tryplover.com**; the step advances by itself when the sign-in arrives (it already does when `needsSignIn` turns false).
- Keep the in-extension sign-in form as a fallback ("Or sign in here").
- Supabase email confirmation goes on (manual dashboard step, after custom SMTP).

## Design

```
extension welcome / popup ──opens tab──▶ https://tryplover.com/connect
                                            │ 1. user signs in / signs up (website session)
                                            │ 2. supabase.functions.invoke("extension-handoff")
                                            │       ─▶ Edge Function: verify the user's JWT,
                                            │          auth.admin.generateLink({type:"magiclink", email})
                                            │          ◀─ { tokenHash }   (no email is sent)
                                            │ 3. chrome.runtime.sendMessage(EXTENSION_ID,
                                            │       { type: "plover/handoff", tokenHash })
                                            ▼
extension worker: runtime.onMessageExternal
   sender.origin must be https://tryplover.com (dev build also http://localhost:5173)
   → dispatch({ type: "auth/handoff", tokenHash })
   → supabase.auth.verifyOtp({ token_hash, type: "magiclink" })  → its own session
   → needsSignIn = false
```

Why a one-time token and not the website's tokens: Supabase rotates refresh tokens and revokes the whole session on reuse, so two clients must not share one session. The magic-link token hash works once and expires (Supabase OTP expiry). The website sends it only to the allowlisted extension ID; the extension accepts it only from the website origin.

`plover/ping` (external): returns `{ ok: true, signedIn: boolean, version: string }` so `/connect` can tell "not installed / too old" from "installed".

Rollout order: extension receiver ships in a store update first (v0.1.8 in review has no `externally_connectable`). `/connect` must handle "extension not reachable" with a clear message and a fallback ("Open Plover and use Sign in there").

## Plover repo (branch `claude/youthful-hawking-f73f2i`)

### Task P1: extension receives the handoff

Files:

- `extension/manifest.config.ts`: add `externally_connectable: { matches: ["https://tryplover.com/*"] }`. In `wxt.config.ts`, for dev builds (`wxt.config.mode === "development"` in the `build:manifestGenerated` hook, or `import.meta.env`-free equivalent) also allow `"http://localhost:5173/*"`.
- `extension/src/features/auth/handoff.ts` (new, pure): `WEBSITE_ORIGINS` (prod + dev), `isTrustedWebsiteSender(sender: { origin?: string; url?: string }, dev: boolean): boolean`, `parseExternalMessage(msg: unknown): { type: "ping" } | { type: "handoff"; tokenHash: string } | null` (tokenHash: non-empty string, max 512 chars, `[A-Za-z0-9_-]` only).
- `extension/src/shared/messages.ts`: add `{ type: "auth/handoff"; tokenHash: string }` to `Command` and `COMMAND_TYPES`.
- `extension/src/features/auth/worker.ts`: handler `auth/handoff` → `getSupabase().auth.verifyOtp({ token_hash, type: "magiclink" })`; on error `{ ok:false, error }`, on success `signedIn()`.
- `extension/src/entrypoints/background.ts`: `browser.runtime.onMessageExternal.addListener((msg, sender, sendResponse) => …)`: reject untrusted sender or bad message (return false); `ping` → respond `{ ok:true, signedIn: !(await getLocal("needsSignIn")), version: browser.runtime.getManifest().version }`; `handoff` → `dispatch({ type:"auth/handoff", tokenHash })` then `sendResponse`; return true.
- Tests: `extension/tests/features/auth/handoff.test.ts` (origins: prod ok, `http://tryplover.com` no, `https://evil.tryplover.com.x` no, dev origin only when dev; message parsing edge cases) and a case in `tests/features/auth/worker.test.ts` for `auth/handoff` (mock `verifyOtp`; success flips `needsSignIn`, error keeps it).
- `docs/DESIGN.md`: §4.9 (website handoff paragraph), §6 (`externally_connectable` to tryplover.com; no new permission or warning), §3/§2.1 if contexts list external messages.

### Task P2: sign-in UI points to the website

- `extension/src/shared/links.ts`: `CONNECT_URL = "https://tryplover.com/connect"`.
- `extension/src/ui/components/SignIn.tsx`: on top, a brand button **Sign in on tryplover.com** that opens `CONNECT_URL` in a new tab (`browser.tabs.create`). The existing Google + email form moves behind a text button **Or sign in here** (collapsed by default). Keep the confirm-email notice.
- Welcome step 2 (`entrypoints/welcome/steps.tsx` `SignInStep`): body copy "Sign in or create your account on tryplover.com. This page moves on by itself when you're signed in." Uses `SignIn` (so it gets the same button).
- `docs/DESIGN.md` §4.9 and §4.12 step 2.
- No new tests (UI scaffolding).

### Task P3: "Save for later" wraps in the 360px popup

`TimerControls` row (Pause / Skip / Save for later / Stop) wraps "Save for later" onto three lines. Fix in `extension/src/ui/components/Panel.css` (e.g. `white-space: nowrap` on the text buttons and let the row wrap as a whole, or a smaller gap). Verify by screenshot at 360px wide.

## Website repo `tryplover/plover-website` (branch `claude/youthful-hawking-f73f2i`)

Checks: `npx vitest run` green; `npx eslint <touched files>` adds no new errors (main already has 76 lint errors); `npm run build` passes.

### Task W1: Edge Function `extension-handoff`

- `supabase/functions/extension-handoff/index.ts` (Deno, style of `join-waitlist`): CORS allow-origin `https://tryplover.com` and `http://localhost:5173` (echo the request origin only if in that list); `OPTIONS` → 204; `POST` only. Read `Authorization: Bearer <jwt>`; `admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)`; `admin.auth.getUser(jwt)` → 401 if no user or no email; 403 if `email_confirmed_at` is null; `admin.auth.admin.generateLink({ type: "magiclink", email })` → `{ tokenHash: data.properties.hashed_token }`. Never return the action link or any other field. No email is sent by `generateLink`.
- `supabase/config.toml`: `[functions.extension-handoff] verify_jwt = false` (the function verifies the JWT itself; gateway JWT checks break with the new publishable keys).
- Deploy (manual, owner): `npx supabase functions deploy extension-handoff --project-ref zchworszzyhufxumnkfw`.

### Task W2: `/connect` page

- `src/config/extension.js`: `EXTENSION_IDS = ["mljdeimnoodcnlbdkcojejgmgbgjcand"]` plus `import.meta.env.VITE_DEV_EXTENSION_ID` when set; `CHROME_STORE_URL = "https://chromewebstore.google.com/detail/mljdeimnoodcnlbdkcojejgmgbgjcand"`.
- `src/lib/extension.js`: `pingExtension()` and `sendHandoff(tokenHash)` over `window.chrome?.runtime?.sendMessage(id, msg, cb)`, trying each ID, with a 1.5 s timeout; `chrome.runtime` is undefined on the page when no matching extension is installed.
- `src/routes/Connect.jsx` + route `/connect` in `App.jsx` (`noindex` via Helmet). States: checking → not installed / too old ("Install Plover" link, or "Update Plover: open chrome://extensions and click Update") → signed out on the website (embedded sign-in/sign-up: reuse `AuthModal` content; OAuth and confirmation emails return to `/connect`) → connecting → **"Plover is connected. You can close this tab."** → error with retry. Show the signed-in email and a "Not you? Sign out" link.
- `src/components/shared/AuthModal.jsx`: accept a `returnTo` path (default `/`) used for OAuth `redirectTo` and `signUp` `options.emailRedirectTo`.
- Strings in `src/locales/en.json` via `useTranslation`.
- Tests: `src/lib/__tests__/extension.test.js` (no `chrome` → not installed; timeout; first ID that answers wins).

### Task W3: open sign-up (no waitlist)

- `src/config/features.js`: `WAITLIST_MODE = false`; add `STORE_LIVE = false` (flip to true after store approval).
- Every CTA that used the desktop download (`Hero`, `FinalCTA`, `Nav`, `WhyPlover`, `DownloadButton` callers): `STORE_LIVE` → "Add to Chrome" linking `CHROME_STORE_URL`; else "Coming soon to Chrome" (disabled) next to **Sign up** (opens `AuthModal` in sign-up mode). Remove `useLatestRelease`/`useOSDetection` use from these CTAs (desktop app is gone); leave the hook files if tests import them.
- Copy: hero note "For Chrome and other Chromium browsers" (drop "Coming soon" when `STORE_LIVE`); remove waitlist wording from visible CTAs.

## Manual steps (owner)

1. Supabase → Authentication → URL Configuration → Redirect URLs: add `https://tryplover.com/connect` and `https://mljdeimnoodcnlbdkcojejgmgbgjcand.chromiumapp.org/**`.
2. Google OAuth client (`plover-server-liyuxiao`): add `https://mljdeimnoodcnlbdkcojejgmgbgjcand.chromiumapp.org/`.
3. Supabase: custom SMTP, then Authentication → Sign In / Providers → Email → **Confirm email** on.
4. Deploy the Edge Function (W1).
5. After store approval: `STORE_LIVE = true`, redeploy the website.

## Verification

- Plover: `pnpm typecheck && pnpm lint && pnpm test`; build and load in Chromium; a page on `http://localhost:5173` (dev build) calls `chrome.runtime.sendMessage(id, {type:"plover/ping"})` and gets a reply; a page on another origin gets none.
- Website: tests, touched-file lint, build; `/connect` renders each state with a stubbed `window.chrome`.
