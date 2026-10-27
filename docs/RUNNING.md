# Running Plover locally (manual end-to-end)

This guide takes you from a fresh clone to exercising the extension by hand: **sign in, task breakdown (Gemini via `plover-server`), timer, blocking, focus mode, Calendar**. Unit tests cover the logic; this walkthrough is the manual E2E.

All commands run from the **repo root** unless noted.

## 1. Prerequisites

- **Node 22** (matches `.nvmrc`): `nvm use`
- **pnpm >= 9**
- A Chromium browser (Chrome, Edge, Brave, Arc)

```bash
pnpm install
```

## 2. Chrome extension (`extension/`)

**Environment.** Copy `extension/.env.example` to `extension/.env` and fill in:

- `WXT_SUPABASE_URL`, `WXT_SUPABASE_ANON_KEY` - the Supabase project shared with `plover-website` and `plover-server`
- `WXT_PLOVER_BACKEND_URL` - the `plover-server` base URL (task breakdown calls `POST /api/decompose`)
- `WXT_GOOGLE_CLIENT_ID` - a Google OAuth client of type **Web application** (not Desktop)

**Run.** From the repo root:

```bash
pnpm dev          # WXT dev mode
pnpm build        # production build
```

In Chrome/Edge/Brave/Arc open `chrome://extensions`, enable Developer mode, **Load unpacked**, and pick `extension/.output/chrome-mv3` (production build). `pnpm dev` writes `extension/.output/chrome-mv3-dev` instead (load that folder when developing); `pnpm build` writes `chrome-mv3`. Reload the extension after manifest changes.

**Redirect URL.** Sign-in and Calendar use `launchWebAuthFlow`, whose redirect is `https://<extension-id>.chromiumapp.org/` (the ID is shown on `chrome://extensions`). Add that exact URL to:

1. Supabase Dashboard -> Authentication -> URL Configuration -> **Redirect URLs**
2. The Google OAuth **Web application** client -> **Authorised redirect URIs** (Google Cloud Console -> APIs & Services -> Credentials)

Also enable the Google Calendar API and add `https://www.googleapis.com/auth/calendar.readonly` to the consent screen scopes.

**Pin the dev extension ID.** An unpacked extension's ID depends on its folder path, so the redirect URL would change per machine. Pin it by adding a `key` to `extension/manifest.config.ts`: generate a key pair (`openssl genrsa 2048 | openssl rsa -pubout -outform DER | openssl base64 -A` gives the public key to use as `key`; keep the private key out of the repo), reload, and register the resulting stable ID's redirect URL. Do not commit a key you intend to use for the Web Store build.

**Try it.**

1. Open the popup, sign in, type a task, get steps (empty editable list if the backend is unreachable), start a focus block.
2. Settings (options page): timer lengths, blocked sites, buddy visibility, Calendar connect/disconnect, sign out. Change the shortcut at `chrome://extensions/shortcuts`.
3. Browse any http(s) page: the buddy sits in the chosen corner; drag it to another corner, click it for the panel, use "Hide on this site" / "Hide everywhere".
4. Turn on Focus mode and open a blocked site: it redirects to the blocked page until the block ends.

Run the tests with `pnpm test`.

## 3. Backend (`plover-server`)

Task breakdown calls `POST /api/decompose` on `plover-server`. Sign-in is Supabase; the extension sends the session's access token as `Authorization: Bearer <token>`, and the server verifies it against Supabase.

### A. Point at the hosted server

Set `WXT_PLOVER_BACKEND_URL=https://plover-server-562340206018.us-central1.run.app` in `extension/.env`, then rebuild or restart `pnpm dev` (WXT bakes `WXT_*` vars at build time).

### B. Run a local plover-server

Clone the server repo alongside this one and follow its README to configure `.env` (Gemini API key, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` - the **same** Supabase project as `WXT_SUPABASE_URL`, but the service-role key, never the anon key):

```bash
git clone https://github.com/tryplover/plover-server
cd plover-server
# follow README to set up .env
pnpm install
pnpm dev
```

The server listens on `http://localhost:3000` by default; set `WXT_PLOVER_BACKEND_URL` to match (use another `PORT` if 3000 is taken).

## 4. Troubleshooting

| Symptom                                            | Likely cause / fix                                                                                                                                              |
| -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sign-in fails with a redirect error                | `https://<extension-id>.chromiumapp.org/` isn't registered in Supabase Redirect URLs and the Google Web client's Authorised redirect URIs.                      |
| 401 on API calls right after signing in            | `WXT_PLOVER_BACKEND_URL` points at a `plover-server` without the Supabase-auth middleware, or its `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` are misconfigured. |
| 429 on task breakdown                              | Per-user daily quota exhausted. Wait until UTC midnight, or bump the quota in `plover-server`.                                                                  |
| 404 on task breakdown against localhost            | Another service owns port 3000; move `plover-server` and update `WXT_PLOVER_BACKEND_URL`.                                                                       |
| Google `redirect_uri_mismatch` on Calendar connect | The OAuth client isn't type **Web application**, or the redirect URL above is missing.                                                                          |
| Google `access_denied` / "app not verified"        | Your email isn't a **Test user** on the consent screen.                                                                                                         |
