# Extension release pipeline Plan

> **For agentic workers:** implement the steps in order. Steps use checkbox (`- [ ]`) syntax. Run every command from the repo root.

**Goal:** A documented, automated way to ship the extension to the Chrome Web Store. Pushing a tag `vX.Y.Z` runs the checks, builds the store zip with production values from GitHub secrets, attaches the zip to a GitHub release in this repo, and (once the store credentials exist) uploads it to the Web Store and submits it for review.

**Decisions (already made, don't revisit):**
- **No `tryplover/Plover-Releases`.** That repo hosted public `.dmg`/`.exe` downloads for the deleted Electron app. The extension installs from the Web Store, so the zip only needs to be kept for the record and rollback: a GitHub release in this (private) repo.
- **The tag is the version.** CI writes the tag's version into `extension/package.json` before building (not committed). WXT copies `package.json`'s `version` into the manifest. The Web Store rejects an upload whose version isn't higher than the last one.
- **Web Store upload uses WXT's built-in `wxt submit`** (publish-browser-extension 6.2, Chrome Web Store API v2, Google service account). No new dependency.
- **The store step is skipped while `CHROME_EXTENSION_ID` is unset.** The very first upload must be manual (the store assigns the extension ID then), so the workflow is useful from day one: it builds and archives the zip, and you upload it by hand.

## Files

- Create `.github/workflows/release.yml`
- Create `docs/RELEASING.md`
- Modify `docs/RUNNING.md`: one line under "Run." pointing to `docs/RELEASING.md` for store releases.
- Modify `CLAUDE.md`: in the Workspace layout block, add `release.yml` under `.github/workflows/` (one line, comment "tag vX.Y.Z → zip → GitHub release → Web Store"); in the Commands table add `pnpm --filter ./extension run zip` ("Production build + store zip in `extension/.output/`").

## `.github/workflows/release.yml`

Match `ci.yml`'s style and action versions (`actions/checkout@v7`, `pnpm/action-setup@v6.0.10`, `actions/setup-node@v7` with `node-version-file: .nvmrc` and `cache: pnpm`). For the GitHub release use `softprops/action-gh-release@v3` (the version the old Electron release workflow used).

Triggers:
- `push: tags: ["v*"]`
- `workflow_dispatch` with inputs:
  - `version` (string, required): e.g. `0.1.0`, no leading `v`.
  - `store` (choice, default `none`): `none` (build and archive only), `upload` (upload the zip, don't submit for review), `submit` (upload and submit for review).

`concurrency: group: release, cancel-in-progress: false`. One job `release`, `runs-on: ubuntu-latest`, `timeout-minutes: 20`, `permissions: contents: write`.

Steps:
1. **Resolve version.** Bash step with `id: v`. On a tag push, the version is `${GITHUB_REF_NAME#v}` and `store` is `submit`; on `workflow_dispatch` use the inputs (pass them via `env:`, never interpolate `${{ inputs.* }}` into the script body). Fail with a clear message unless the version matches `^[0-9]+\.[0-9]+\.[0-9]+$`. Output `version`, `tag` (`v<version>`) and `store`.
2. Checkout, setup pnpm, setup node, `pnpm install --frozen-lockfile`.
3. `pnpm typecheck`, `pnpm lint`, `pnpm test` (three steps).
4. **Check build secrets.** Env `WXT_SUPABASE_URL`, `WXT_SUPABASE_ANON_KEY`, `WXT_GOOGLE_CLIENT_ID` from `secrets.*` and `WXT_PLOVER_BACKEND_URL` from `vars.WXT_PLOVER_BACKEND_URL`. Loop over the four names; for each empty one print `::error::Missing <NAME>: add it under Settings → Secrets and variables → Actions` and exit 1 at the end if any were missing.
5. **Set version.** `pnpm --filter ./extension exec npm pkg set version="$VERSION"` with `VERSION` from step 1's output via `env:`.
6. **Build zip.** `pnpm --filter ./extension run zip` with the same four `WXT_*` env vars as step 4.
7. **Verify the build.** Bash: `m=extension/.output/chrome-mv3/manifest.json`; with `node -e`, read it and fail (non-zero exit with a message) if `version` isn't `$VERSION`, if `host_permissions` is present, or if `content_scripts` is present (site access must stay optional, spec §6.1). Then `zip=$(ls extension/.output/*-chrome.zip)` and write `zip=<path>` to `$GITHUB_OUTPUT` (give this step `id: build`).
8. **GitHub release.** `softprops/action-gh-release@v3` with `tag_name: ${{ steps.v.outputs.tag }}`, `name: Plover ${{ steps.v.outputs.tag }}`, `files: ${{ steps.build.outputs.zip }}`, `generate_release_notes: true`, and `target_commitish: ${{ github.sha }}` (so a manual run creates the tag at the commit it built).
9. **Web Store.** Runs only if `steps.v.outputs.store != 'none'`. Bash step with env:
   - `CHROME_EXTENSION_ID: ${{ secrets.CHROME_EXTENSION_ID }}`
   - `CHROME_PUBLISHER_ID: ${{ secrets.CHROME_PUBLISHER_ID }}`
   - `CHROME_SERVICE_ACCOUNT_CLIENT_EMAIL: ${{ secrets.CHROME_SERVICE_ACCOUNT_CLIENT_EMAIL }}`
   - `CHROME_SERVICE_ACCOUNT_PRIVATE_KEY: ${{ secrets.CHROME_SERVICE_ACCOUNT_PRIVATE_KEY }}`
   - `CHROME_API_VERSION: v2`
   - `CHROME_ZIP: ${{ github.workspace }}/${{ steps.build.outputs.zip }}`
   - `STORE: ${{ steps.v.outputs.store }}`

   Script: if `CHROME_EXTENSION_ID` is empty, print `::warning::CHROME_EXTENSION_ID is not set, so the zip was not uploaded. Upload it by hand (docs/RELEASING.md, "First release").` and exit 0. If any of the other three credentials is empty, `::error::` naming it and exit 1. If `STORE` is `upload`, `export CHROME_SKIP_SUBMIT_REVIEW=true`. Then `pnpm --filter ./extension exec wxt submit`.

No other jobs. No comments in the YAML except where the WHY is non-obvious (e.g. why the store step is skippable).

## `docs/RELEASING.md`

Plain, short sections. Title "Releasing the extension". Content:

1. **How a release works.** One paragraph + the step list from the workflow (checks → build with production values → verify manifest → GitHub release with the zip → Web Store upload and review). Note that Web Store review usually takes from a few hours to a few days, and the listing stays **unlisted** (only people with the link can install), set once in the dashboard.
2. **Cut a release.** Pick the next version (semver; must be higher than the last store version). Commands, each in its own fenced `bash` block: `git checkout main`, `git pull`, `git tag v0.1.0`, `git push origin v0.1.0`. Then watch the "Release" run in the Actions tab. Alternative: Actions → Release → Run workflow with a version and a store mode (`none` / `upload` / `submit`).
3. **One-time setup.** Numbered:
   1. GitHub repository secrets (Settings → Secrets and variables → Actions): `WXT_SUPABASE_URL`, `WXT_SUPABASE_ANON_KEY`, `WXT_GOOGLE_CLIENT_ID` (secrets) and `WXT_PLOVER_BACKEND_URL` (a variable, `https://plover-server-562340206018.us-central1.run.app`). Same values as a production `extension/.env`. Never the Supabase `service_role` key or the Google client secret: everything in these ends up readable inside the shipped extension.
   2. Chrome Web Store developer account (one-time registration fee) at https://chrome.google.com/webstore/devconsole.
   3. **First release (manual).** Run the workflow with store `none` (or `git tag v0.1.0`), download the zip from the GitHub release, create a new item in the developer dashboard and upload it. Fill in the listing (description, screenshots, privacy policy URL `https://tryplover.com/privacy`, a justification for each permission and for optional all-sites access: the buddy draws itself and reads nothing on the page, spec §6.1), set **Visibility: Unlisted**, submit for review. Copy the **extension ID** and the **publisher ID** from the dashboard.
   4. **Redirect URLs for the store ID:** add `https://<store-extension-id>.chromiumapp.org/**` to Supabase → Authentication → URL Configuration → Redirect URLs, and `https://<store-extension-id>.chromiumapp.org/` to the Google OAuth client's Authorised redirect URIs (Google Cloud project `plover-server-liyuxiao` → Credentials → `plover-server`). Without these, sign-in and Calendar fail in the store build only.
   5. **Automatic uploads:** in Google Cloud, create a service account (e.g. `plover-webstore-publisher`) and a JSON key; enable the Chrome Web Store API; in the Web Store developer dashboard → Account, add the service account's email as a user. Add secrets `CHROME_EXTENSION_ID`, `CHROME_PUBLISHER_ID`, `CHROME_SERVICE_ACCOUNT_CLIENT_EMAIL`, `CHROME_SERVICE_ACCOUNT_PRIVATE_KEY` (the `private_key` field of the JSON, including the BEGIN/END lines). Check with Actions → Release → Run workflow, store `upload`. Link: https://developer.chrome.com/docs/webstore/using-api.
4. **Before the first public waitlist invite** (checklist): privacy policy live at the URL above; Supabase custom SMTP (built-in email is rate-limited to a few per hour); Google OAuth consent screen either lists every tester as a test user (max 100) or has passed verification for `calendar.readonly`; `plover-server` accepts requests from `chrome-extension://<store-extension-id>` if it restricts origins.
5. **Rolling back.** The store can't install an older version number. Revert the bad change on `main`, then release a new, higher version. The previous zips stay on the GitHub releases page for reference.
6. **Why not Plover-Releases.** One or two sentences: it served public desktop downloads; the extension installs from the Web Store, so it isn't used for the extension.

## Verification

- [ ] `actionlint` isn't installed; instead run `node -e` with the `yaml` parser if available, or `python3 -c "import yaml,sys; yaml.safe_load(open('.github/workflows/release.yml'))"` to confirm the YAML parses.
- [ ] Simulate steps 5–7 locally: `pnpm --filter ./extension exec npm pkg set version=9.9.9`, build the zip with placeholder `WXT_*` env values, run the step-7 verification script against the output and confirm it passes; then restore `extension/package.json` with `git checkout -- extension/package.json`. (This is the one allowed `git checkout`, on that file only.)
- [ ] `pnpm typecheck && pnpm lint && pnpm test`.
- [ ] `git diff --stat` shows only the four files listed above.
