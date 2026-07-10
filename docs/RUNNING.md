# Running Plover locally (manual end-to-end)

This guide walks you from a fresh clone to exercising the full Plover flow by
hand: **sign in → goal capture → Gemini decomposition → scheduling → Google
Calendar sync → Today view**. There is no automated E2E harness yet — this *is*
the E2E test.

All commands run from the **repo root** unless noted.

## 1. Prerequisites

- **Node 22** (matches `.nvmrc`): `nvm use`
- **pnpm ≥ 9**
- **macOS** (the global hotkey, keychain, and packaging are macOS-only for now)

## 2. Install

```bash
pnpm install
```

This builds the native modules `better-sqlite3` (SQLite) and `keytar`
(macOS Keychain) via the root `package.json` `onlyBuiltDependencies` allowlist.
If either fails to build:

```bash
pnpm --filter ./app rebuild better-sqlite3 keytar
```

## 3. Sign in on first launch

Plover uses a hosted backend (`plover-server`) for all Gemini calls. On first
launch, the app boots into a small **signup window** with a **Continue with
Google** button:

1. Click the button. The default browser opens the plover-server signup page.
2. Approve the Google consent screen (scopes: `openid email`).
3. The server redirects to `plover://auth?token=…&state=…`.
4. Electron catches the deep link, verifies the state nonce, and stores the
   token in the macOS Keychain (service `plover`, account `plover_token`).
5. The main window opens.

On subsequent launches, the token is found in the keychain and the signup
window is skipped. The signup logic lives in
`app/src/main/auth/signup-flow.ts`; the boot gate lives in
`app/src/main/index.ts`.

## 4. Run

```bash
pnpm dev
```

At build time, `PLOVER_BACKEND_URL` is baked into the main-process bundle by
`electron-vite`'s `define`. In dev builds where the env var is unset, the app
falls back to `http://localhost:3000` — which won't have anything listening
unless you run a local `plover-server`. Pick one:

### A. Point dev at the hosted server

```bash
PLOVER_BACKEND_URL=https://plover-server-562340206018.us-central1.run.app pnpm dev
```

Sign in through the browser flow when the signup window appears. See the
`plover://` caveat below — macOS may route the redirect to a different app
bundle than the one you're running.

### B. Run a local plover-server

Clone the server repo alongside this one and follow its README to configure
`.env` (Gemini API key, Google OAuth web-app client, Firestore project):

```bash
git clone https://github.com/tryplover/plover-server
cd plover-server
# follow README to set up .env
pnpm install
pnpm dev
```

The server runs on `http://localhost:3000`. From this repo, `pnpm dev` picks
that up as the default. Same `plover://` caveat applies.

## 5. The `plover://` protocol-handler caveat

macOS routes custom URL schemes to the **last-launched app bundle** that
registered them. If you've never packaged Plover locally, the OS may not have
your dev instance registered — the browser will succeed but the `open-url`
event never fires in your dev main process.

Workaround: package the app once so macOS registers the bundle.

```bash
pnpm package
open app/dist/*.dmg  # drag into /Applications, launch once
```

After that, `pnpm dev` iteration works normally — Electron re-registers on
each dev launch since it's now the most recent handler. **Symptom to watch
for:** signup window stays on the "waiting…" state after the browser redirect
completes.

## 6. Google Calendar OAuth (for the app, not signup)

This is separate from the plover-server signup OAuth. The app talks to Google
Calendar directly on behalf of the user, using a **desktop-app** OAuth client.

1. **Google Cloud Console** → create (or pick) a project.
2. **Enable the Google Calendar API** for that project.
3. **OAuth consent screen** → User type **External** → add your own email as a
   **Test user**. Required while the app is unverified because `calendar.events`
   is a sensitive scope.
4. **Credentials → Create credentials → OAuth client ID → Application type
   "Desktop app"**. The app uses a loopback redirect (`http://localhost:{port}`,
   a random port per attempt).
5. Copy the client ID and secret into `app/.env` as `GOOGLE_CLIENT_ID` and
   `GOOGLE_CLIENT_SECRET`.

Without these, the calendar connect flow uses `mock-client-id` placeholders
and fails; the rest of the app still runs.

## 7. Manual E2E walkthrough

1. **First launch** — signup window appears. Click **Continue with Google**,
   approve consent in the browser, wait for the main window to open.
2. **Connect Google Calendar** — **Settings → Connect Google Calendar**.
   Approve consent. The refresh token is stored under service `plover`,
   account `google-refresh-token`.
3. **Capture and decompose a goal** — **Goals** tab, enter
   *"Write a 10-page research report by next Friday"*, **Decompose**. Verify
   Gemini returns an ordered subtask list with estimates and dependencies.
   **Schedule**, **Save**.
4. **Today view** — confirm scheduled tasks appear; toggle one done.
5. **Verify the calendar** — open Google Calendar in a browser; confirm events.
6. **Overlay quick-add** — press **Option + Space**, type a goal, **propose**,
   **commit**, confirm it shows up in Today.

## 8. Building for release

The `PLOVER_BACKEND_URL` env var is baked into the release bundle at build
time:

```bash
PLOVER_BACKEND_URL=https://plover-server-562340206018.us-central1.run.app pnpm package
```

Dev builds without the env var fall back to `http://localhost:3000`. Power
users can override at runtime by exporting `PLOVER_BACKEND_URL` before launch.

## 9. Reset / inspect local state

- **Database:** `~/Library/Application Support/Plover/plover.db` (plus `-wal`
  and `-shm`). Delete to wipe goals/tasks; migrations re-run on next launch.
- **Google Calendar auth:** **Settings → Disconnect**, or
  `security delete-generic-password -s plover -a google-refresh-token`.
- **Plover signup token:** force re-signup by clearing the keychain entry:

  ```bash
  security delete-generic-password -s plover -a plover_token
  ```

  Next launch opens the signup window again.

## 10. Troubleshooting

| Symptom | Likely cause / fix |
|---|---|
| Nothing happens when I click "Continue with Google" | `PLOVER_BACKEND_URL` doesn't resolve, or the renderer errored — check devtools console. |
| Browser opened but app didn't catch the redirect | `plover://` handler is registered to another bundle. Run `pnpm package` once and launch the packaged app so macOS registers this build. See §5. |
| 401 loop on API calls | Token was revoked server-side. Run `security delete-generic-password -s plover -a plover_token` and re-sign in. |
| 429 on decompose / infer | Per-user daily quota exhausted. Wait until UTC midnight, or bump the quota in `plover-server`. |
| OAuth `redirect_uri_mismatch` (Calendar) | OAuth client isn't type **Desktop app** — recreate it. |
| OAuth `access_denied` / "app not verified" (Calendar) | Your email isn't added as a **Test user** on the consent screen. |
| `Cannot find module 'better-sqlite3'` / keytar errors | Native build failed — `pnpm --filter ./app rebuild better-sqlite3 keytar`. |
| Option+Space does nothing | Another app owns the hotkey — check the dev console for "Failed to register global shortcut". |

## 11. Automated tests

Unit + mocked-integration tests (Planner, Scheduler, Store, Sync, IPC, signup
flow) run with:

```bash
pnpm test
pnpm --filter ./app run test:coverage
```

There is no automated full-app E2E suite yet — that's deferred. The
walkthrough above is the manual stand-in.
