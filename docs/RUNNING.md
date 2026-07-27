# Running Plover locally (manual end-to-end)

This guide walks you from a fresh clone to exercising the full Plover flow by hand: **sign in → goal capture → Gemini decomposition → local scheduling → Today view**. There is no automated E2E harness yet — this *is* the E2E test.

All commands run from the **repo root** unless noted.

## 1. Prerequisites

- **Node 22** (matches `.nvmrc`): `nvm use`
- **pnpm ≥ 9**
- **macOS** (the global hotkey, keychain, and packaging are macOS-only for now)

## 2. Install

```bash
pnpm install
```

This builds the native modules `better-sqlite3` (SQLite) and `keytar` (macOS Keychain) via the root `package.json` `onlyBuiltDependencies` allowlist. If either fails to build:

```bash
pnpm --filter ./app rebuild better-sqlite3 keytar
```

## 3. Sign in on first launch

Plover uses a hosted backend (`plover-server`) for all Gemini calls. On first launch, the app boots into a small **signup window** with a **Continue with Google** button:

1. Click the button. The default browser opens the plover-server signup page.
2. Approve the Google consent screen (scopes: `openid email`).
3. The server redirects to `plover://auth?token=…&state=…`.
4. Electron catches the deep link, verifies the state nonce, and stores the token in the macOS Keychain (service `plover`, account `plover_token`).
5. The main window opens.

On subsequent launches, the token is found in the keychain and the signup window is skipped. The signup logic lives in `app/src/main/auth/signup-flow.ts`; the boot gate lives in `app/src/main/index.ts`.

## 4. Run

```bash
pnpm dev
```

At build time, `PLOVER_BACKEND_URL` is baked into the main-process bundle by `electron-vite`'s `define`. In dev builds where the env var is unset, the app falls back to `http://localhost:3000` — which won't have anything listening unless you run a local `plover-server` (or point at the hosted staging server).

### A. Point dev at the hosted server

```bash
PLOVER_BACKEND_URL=https://plover-server-562340206018.us-central1.run.app pnpm dev
```

Sign in through the browser flow when the signup window appears. See the `plover://` caveat below — macOS may route the redirect to a different app bundle than the one you're running.

### B. Run a local plover-server

Clone the server repo alongside this one and follow its README to configure `.env` (Gemini API key, Google OAuth web-app client, Firestore project):

```bash
git clone https://github.com/tryplover/plover-server
cd plover-server
# follow README to set up .env
pnpm install
pnpm dev
```

The server runs on `http://localhost:3000`. From this repo, `pnpm dev` picks that up as the default. Same `plover://` caveat applies.

## 5. The `plover://` protocol-handler caveat

macOS routes custom URL schemes to the **last-launched app bundle** that registered them. If you've never packaged Plover locally, the OS may not have your dev instance registered — the browser will succeed but the `open-url` event never fires in your dev main process.

Workaround: package the app once so macOS registers the bundle.

```bash
pnpm package
open app/dist/*.dmg  # drag into /Applications, launch once
```

After that, `pnpm dev` iteration works normally — Electron re-registers on each dev launch since it's now the most recent handler. **Symptom to watch for:** signup window stays on the "waiting…" state after the browser redirect completes.

## 6. Google Docs/Drive OAuth (for the app, not signup)

This is separate from the plover-server signup OAuth. The app talks to Google Docs/Drive APIs directly on behalf of the user to poll for document modifications, using a **desktop-app** OAuth client.

1. **Google Cloud Console** → create (or pick) a project.
2. **Enable the Google Drive API** for that project.
3. **OAuth consent screen** → User type **External** → add your own email as a **Test user**. Required while the app is unverified because `drive.metadata.readonly` is requested.
4. **Credentials → Create credentials → OAuth client ID → Application type "Desktop app"**. The app uses a loopback redirect (`http://localhost:{port}`, a random port per attempt).
5. Copy the client ID and secret into `app/.env` as `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.

Without these, the Google connection flow uses `mock-client-id` placeholders and fails; the rest of the app still runs.

## 7. Manual E2E walkthrough

1. **First launch** — signup window appears. Click **Continue with Google**, approve consent in the browser, wait for the main window to open.
2. **Connect Google Docs/Drive** — **Settings → Connect Google Account**. Approve consent. The refresh token is stored under service `plover`, account `google-refresh-token`.
3. **Capture and decompose a goal** — **Goals** tab, enter *"Write a 10-page research report by next Friday"*, **Decompose**. Verify Gemini returns an ordered subtask list with estimates and dependencies. **Schedule**, **Save**.
4. **Today view** — confirm scheduled tasks appear; toggle one done.
5. **Overlay quick-add** — press **Option + Space**, type a goal, **propose**, **commit**, confirm it shows up in Today.

## 8. Building for release

The `PLOVER_BACKEND_URL` env var is baked into the release bundle at build time:

```bash
PLOVER_BACKEND_URL=https://plover-server-562340206018.us-central1.run.app pnpm package
```

Dev builds without the env var fall back to `http://localhost:3000`. Power users can override at runtime by exporting `PLOVER_BACKEND_URL` before launch.

### macOS Gatekeeper Bypass (For Un-notarized Developer/Local Builds)

If you package the app locally without official Apple Developer certificates, macOS Gatekeeper will block the app because it was downloaded from the internet and has not been notarized by Apple.

To open and run the app, you can use any of the following three methods:

#### Method 1: The Finder Bypass (Easiest)
1. Click **OK** to close the warning.
2. Open Finder and locate the `Plover.app` or packaged DMG (e.g., in `/Applications` or your `Downloads` folder).
3. Right-click (or hold Control and click) the Plover app icon, then select **Open** from the menu.
4. A similar warning will appear, but this time it will include an **Open** button. Click **Open** to launch it. macOS will remember this preference and won't prompt you again.

#### Method 2: System Settings
1. Click **OK** to close the warning.
2. Open System Settings and go to **Privacy & Security**.
3. Scroll down to the **Security** section.
4. You will see a note saying: *"Plover" was blocked from use because it is not from an identified developer.*
5. Click **Open Anyway** and enter your credentials.

#### Method 3: Terminal Command (Developer Method)
Run the following command to completely strip the internet download (quarantine) flag from the app bundle:

```bash
# Clear the quarantine attribute from the app bundle
xattr -d com.apple.quarantine /Applications/Plover.app

# Or recursively clear all extended attributes (useful if dynamic libraries are also flagged)
xattr -cr /Applications/Plover.app
```

---

### Codesigning and Notarization for Production Release

Plover is configured with a custom `afterSign` hook (`app/scripts/notarize.cjs`) that automatically submits packaged darwin builds to Apple's notarization servers.

#### Prerequisites
1. A paid Apple Developer Account ($99/year).
2. A **Developer ID Application** certificate installed in your macOS Keychain.

#### Configuration (Environment Variables)
Before running `pnpm package`, make sure the appropriate signing credentials are set in your environment:

* **Option A: App Store Connect API Key (Recommended for CI/CD)**
  ```bash
  export APPLE_API_KEY_ID="10_CHAR_KEY_ID"
  export APPLE_API_ISSUER="YOUR_ISSUER_UUID"
  export APPLE_API_KEY="/path/to/AuthKey.p8" # or raw private key contents
  ```
  
* **Option B: Apple ID & App-Specific Password**
  ```bash
  export APPLE_ID="your-apple-id@example.com"
  export APPLE_ID_PASSWORD="your-app-specific-password-from-appleid.apple.com"
  export APPLE_TEAM_ID="10_CHAR_TEAM_ID"
  ```

If none of these environment variables are set, the notarization script will print a warning and skip notarization, falling back to an ad-hoc signed build.


## 9. Reset / inspect local state

- **Database:** `~/Library/Application Support/Plover/plover.db` (plus `-wal` and `-shm`). Delete to wipe goals/tasks; migrations re-run on next launch.
- **Google Docs/Drive auth:** **Settings → Disconnect**, or `security delete-generic-password -s plover -a google-refresh-token`.
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
| OAuth `redirect_uri_mismatch` (Google) | OAuth client isn't type **Desktop app** — recreate it. |
| OAuth `access_denied` / "app not verified" (Google) | Your email isn't added as a **Test user** on the consent screen. |
| `Cannot find module 'better-sqlite3'` / keytar errors | Native build failed — `pnpm --filter ./app rebuild better-sqlite3 keytar`. |
| Option+Space does nothing | Another app owns the hotkey — check the dev console for "Failed to register global shortcut". |

## 11. Automated tests

Unit + mocked-integration tests (Planner, Scheduler, Store, Sync, IPC, signup flow) run with:

```bash
pnpm test
pnpm --filter ./app run test:coverage
```

There is no automated full-app E2E suite yet — that's deferred. The walkthrough above is the manual stand-in.
