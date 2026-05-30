# Running Plover locally (manual end-to-end)

This guide walks you from a fresh clone to exercising the full Plover flow by
hand: **goal capture → Gemini decomposition → scheduling → Google Calendar sync
→ Today view**. There is no automated E2E harness yet — this *is* the E2E test.

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

## 3. Set up secrets

Secrets are read from `app/.env` (loaded by the main process via Node's built-in
`process.loadEnvFile()`). Copy the stub and fill it in:

```bash
cp app/.env.example app/.env
```

`app/.env` is gitignored — never commit real keys. Exported shell variables of
the same name also work and take precedence if `.env` is absent.

### 3a. Gemini API key (required for decomposition)

1. Go to https://aistudio.google.com/apikey and create an API key.
2. Put it in `app/.env` as `GEMINI_API_KEY=...`.

The planner uses the `gemini-2.0-flash` model.

### 3b. Google OAuth credentials (required for calendar sync)

1. **Google Cloud Console** → create (or pick) a project.
2. **Enable the Google Calendar API** for that project.
3. **OAuth consent screen** → User type **External** → add your own email
   (e.g., your.email@example.com) as a **Test user**. This is required while the
   app is in testing because calendar.events is a sensitive scope.
4. **Credentials → Create credentials → OAuth client ID → Application type
   "Desktop app"**. The app uses a loopback redirect (`http://localhost:{port}`,
   a random port per attempt); desktop clients allow loopback redirects without
   registering an exact port.
5. Copy the client ID and secret into `app/.env` as `GOOGLE_CLIENT_ID` and
   `GOOGLE_CLIENT_SECRET`.

> Without Google creds the app still runs and the UI renders, but the calendar
> connect flow uses non-functional `mock-client-id` placeholders. Without a
> Gemini key, decomposition throws `GEMINI_API_KEY environment variable is not
> set`.

## 4. Run

```bash
pnpm dev
```

Electron launches with HMR for the renderer.

## 5. Manual E2E walkthrough

1. **App opens** — a 1024×720 window titled "Plover" with tabs **Today /
   Goals / Settings**.
2. **Connect Google Calendar** — go to **Settings → Connect Google Calendar**.
   Your browser opens the Google consent screen; approve it. You'll see an
   "Authentication successful" page, and Settings shows the calendar as
   connected. (The refresh token is stored in the macOS Keychain under service
   `plover`, account `google-refresh-token`.)
3. **Capture and decompose a goal** — go to **Goals**, enter something like
   *"Write a 10-page research report by next Friday"* and **Decompose**. Verify
   Gemini returns an ordered list of subtasks with time estimates and
   dependencies. Then **Schedule** and verify the proposed time slots fall
   within your working hours and avoid existing calendar events. **Save**.
4. **Today view** — switch to **Today** and confirm the scheduled tasks appear,
   grouped by time of day. Toggle one to done and confirm the completion count
   updates.
5. **Verify the calendar** — open Google Calendar in a browser and confirm the
   events were created.
6. **Overlay quick-add** — press **Option + Space** anywhere to open the
   frameless overlay, type a goal, **propose**, then **commit**, and confirm it
   shows up in Today.

## 6. Reset / inspect local state

- **Database:** `~/Library/Application Support/Plover/plover.db` (plus `-wal` and
  `-shm` files). Delete them to wipe all goals/tasks; the schema migrations
  re-run on next launch.
- **Google auth:** use **Settings → Disconnect**, or delete the Keychain entry
  for service `plover` (Keychain Access app, or `security delete-generic-password
  -s plover`).

## 7. Troubleshooting

| Symptom | Likely cause / fix |
|---|---|
| `GEMINI_API_KEY environment variable is not set` | `app/.env` missing or `GEMINI_API_KEY` empty; restart `pnpm dev` after editing |
| OAuth `redirect_uri_mismatch` | OAuth client isn't type **Desktop app** — recreate it |
| OAuth `access_denied` / "app not verified" | Your email isn't added as a **Test user** on the consent screen |
| `Cannot find module 'better-sqlite3'` / keytar errors | Native build failed — `pnpm --filter ./app rebuild better-sqlite3 keytar` |
| Option+Space does nothing | Another app owns the hotkey, or macOS needs accessibility focus — check the dev console for "Failed to register global shortcut" |

## 8. Automated tests

Unit + mocked-integration tests (Planner, Scheduler, Store, Sync, IPC) run with:

```bash
pnpm test
pnpm --filter ./app run test:coverage
```

There is no automated full-app E2E suite (Playwright/Spectron) yet — that's
deferred. The walkthrough above is the manual stand-in.
