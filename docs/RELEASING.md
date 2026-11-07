# Releasing the extension

## How a release works

Pushing a tag `vX.Y.Z` runs `.github/workflows/release.yml`. The tag is the version. The workflow:

1. Runs typecheck, lint and tests.
2. Writes the version into `extension/package.json` for the build only (not committed).
3. Builds the store zip with production values from GitHub secrets.
4. Checks the built `manifest.json`: correct version, no `host_permissions`, no `content_scripts`.
5. Creates a GitHub release in this repo with the zip attached (kept for the record and rollback).
6. Uploads the zip to the Chrome Web Store and submits it for review, if the store credentials are set.

## Every merge and weekly store releases

- **Every merge to `main`:** the **Build and version** job in `.github/workflows/ci.yml` runs after typecheck, lint and tests pass. It bumps the patch of the highest `vX.Y.Z` tag (`v0.1.4` becomes `v0.1.5`), builds the zip with that version and publishes it as a GitHub **pre-release**. Nothing goes to the store. Its tag is pushed with the workflow token, so it doesn't trigger `release.yml`.
- **Every Monday 14:00 UTC:** `.github/workflows/store-weekly.yml` takes the newest release. If it's still a pre-release, the workflow uploads that zip to the Web Store, submits it for review and marks it as the latest full release. If nothing new was merged, it does nothing.
- **Hotfix:** Actions → Weekly store release → Run workflow submits the newest build straight away.
- **Minor or major bump:** cut a release by hand (below) with the new number, e.g. `v0.2.0`. Merges after that continue from `v0.2.1`.

Web Store review usually takes a few hours to a few days. The listing stays **unlisted** (only people with the link can install). Set that once in the developer dashboard.

## Cut a release

Pick the next version (semver). It must be higher than the last version on the store.

```bash
git checkout main
```

```bash
git pull
```

```bash
git tag v0.1.0
```

```bash
git push origin v0.1.0
```

Then watch the **Release** run in the Actions tab.

Alternative: Actions → Release → Run workflow, with a version (no leading `v`) and a store mode:

- `none`: build and archive only.
- `upload`: upload the zip to the store, do not submit for review.
- `submit`: upload and submit for review.

## One-time setup

1. **GitHub secrets and variable** (Settings → Secrets and variables → Actions):
   - Secrets: `SUPABASE_URL` and `SUPABASE_ANON_KEY` (already there from the Electron release workflow; the build passes them in as `WXT_SUPABASE_URL` / `WXT_SUPABASE_ANON_KEY`).
   - Variables (Variables tab; not secret): `WXT_GOOGLE_CLIENT_ID` = `562340206018-d8m6t93hhbk6fkojbg1jvb5qah8bq5g9.apps.googleusercontent.com` and `WXT_PLOVER_BACKEND_URL` = `https://plover-server-562340206018.us-central1.run.app`.

   Use the same values as a production `extension/.env`. Never put the Supabase `service_role` key or the Google client secret here: everything in these ends up readable inside the shipped extension.

2. **Chrome Web Store developer account.** Register once (one-time fee) at https://chrome.google.com/webstore/devconsole.

3. **First release (manual).** The store assigns the extension ID only on the first upload, so the first upload is by hand:
   1. Run the Release workflow with store `none` (or push a tag).
   2. Download the zip from the GitHub release.
   3. In the developer dashboard, create a new item and upload the zip.
   4. Fill in the listing: description, screenshots, privacy policy URL `https://tryplover.com/privacy`, and a justification for each permission and for optional all-sites access. The buddy draws itself and reads nothing on the page (`docs/DESIGN.md` §4.2 and §6).
   5. Set **Visibility: Unlisted**, then submit for review.
   6. Copy the **extension ID** and the **publisher ID** from the dashboard.

4. **Redirect URLs for the store ID.** Add these so sign-in and Calendar work in the store build:
   - `https://<store-extension-id>.chromiumapp.org/**` to Supabase → Authentication → URL Configuration → Redirect URLs.
   - `https://<store-extension-id>.chromiumapp.org/` to the Google OAuth client's Authorised redirect URIs (Google Cloud project `plover-server-liyuxiao` → Credentials → `plover-server`).

   Without these, sign-in and Calendar fail in the store build only.

5. **Automatic uploads.**
   1. In Google Cloud, create a service account (e.g. `plover-webstore-publisher`) and a JSON key.
   2. Enable the Chrome Web Store API.
   3. In the Web Store developer dashboard → Account, add the service account's email as a user.
   4. Add repository secrets: `CHROME_EXTENSION_ID`, `CHROME_PUBLISHER_ID`, `CHROME_SERVICE_ACCOUNT_CLIENT_EMAIL`, and `CHROME_SERVICE_ACCOUNT_PRIVATE_KEY` (the `private_key` field of the JSON, including the BEGIN and END lines).
   5. Check it: Actions → Release → Run workflow, store `upload`.

   Reference: https://developer.chrome.com/docs/webstore/using-api.

   Until `CHROME_EXTENSION_ID` is set, the store step is skipped with a warning and the workflow only builds and archives the zip.

## Before the public launch

- The privacy policy is live at `https://tryplover.com/privacy`.
- Supabase uses custom SMTP (the built-in email is rate-limited to a few messages per hour).
- The Google OAuth consent screen either lists every tester as a test user (max 100) or has passed verification for `calendar.readonly`.
- `plover-server` accepts requests from `chrome-extension://<store-extension-id>` if it restricts origins.

## Rolling back

The store cannot install an older version number. Revert the bad change on `main`, then release a new, higher version. Earlier zips stay on the GitHub releases page for reference.

## Why not Plover-Releases

The old `tryplover/Plover-Releases` repo served public desktop downloads for the deleted Electron app. The extension installs from the Web Store, so that repo is not used for it. The zip lives on a GitHub release in this repo.
