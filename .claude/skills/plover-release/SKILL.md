---
name: plover-release
description: Use when asked to release, ship, publish or push Plover to the Chrome Web Store ("release Plover", "ship a new version", "push this to the store", "cut v0.2.1"), when choosing the next version number, or when a Release run's Web Store step warns "CHROME_EXTENSION_ID is not set" or fails.
---

# Plover release

## Overview

A store release is a `vX.Y.Z` tag pushed to `main`. The tag runs `.github/workflows/release.yml`, which checks, builds, verifies the manifest, makes a GitHub release with the zip and, when the store secrets exist, uploads to the Chrome Web Store and submits for review. Merges to `main` never release anything: they only leave an unversioned test build on their CI run. Full detail: `docs/RELEASING.md`.

Pushing a tag submits a build to the public store listing. Treat it as outward-facing: confirm the version with the user before pushing, unless they already named it.

## Steps

1. **Sync:** `git fetch origin --tags`.
2. **Check main is green:** `gh run list --branch main --workflow ci.yml --limit 1` must show `success` for the current `origin/main` commit. If it's failing or still running, stop and say so.
3. **Check there is something to ship:** `git log <last-tag>..origin/main --oneline`. If it's empty, say there's nothing new and stop.
4. **Pick the version:** take the highest semver tag (`git tag -l 'v0.*' 'v[1-9].*' --sort=-v:refname | head -1`; plain `'v*'` returns old desktop nightly tags like `v2026.07.23-0402`) and bump the patch (`v0.2.0` → `v0.2.1`). Bump the minor only when the user asks. Tell the user the version and a one-line summary of what's in it (group the commit subjects), and wait for a yes.
5. **Tag and push:** `git tag -a vX.Y.Z origin/main -m "Plover vX.Y.Z"`, then `git push origin vX.Y.Z`. Tag `origin/main`, never a local branch.
6. **Watch the run:** `gh run list --workflow release.yml --limit 1` for the run ID, then `gh run watch <id> --exit-status` in the background.
7. **Read the outcome:** `gh run view <id>` (annotations) and `gh release view vX.Y.Z --json assets`.
8. **Report:** version, the GitHub release link, and the store result: submitted for review, uploaded only, or skipped (see the table below). Google's review takes hours to days, and the update reaches users only after approval.

## Quick reference

| Symptom | Cause | Fix |
| --- | --- | --- |
| Run passes with warning "CHROME_EXTENSION_ID is not set, so the zip was not uploaded" | Store secrets aren't in the repo | Not a failure. The zip is on the GitHub release. The user uploads it on the existing item (ID `mljdeimnoodcnlbdkcojejgmgbgjcand`), Package → Upload new package, then submits. Never create a new store item. Setup for automatic uploads: `docs/RELEASING.md`, "Automatic uploads" |
| Web Store step fails naming a missing `CHROME_PUBLISHER_ID` / `CHROME_SERVICE_ACCOUNT_*` | Only some of the four secrets are set | The user adds the missing ones. Rerun with Actions → Release → Run workflow, same version, store `submit` |
| Web Store upload rejected while an earlier version is in review | The store has a submission pending | Wait for review to finish (or the user cancels it in the dashboard), then rerun the Release workflow for the same version |
| Tempted to reuse `v0.1.x` | `v0.1.1`–`v0.1.54` were made by the old per-merge versioning | Always go above the highest tag. The store also rejects any version not higher than the one it has |
| Something broke in a released version | The store can't install an older version | Revert on `main`, then release a new, higher version |
| A test build from a CI run shows version 0.0.0 | Test builds are unversioned on purpose | Expected; only tags get real numbers |
| `manifest version is …, expected …` or `host_permissions must not be set` | Manifest check in `release.yml` | A real problem in the code on `main`. Fix it on `main` and tag a new version; don't delete and re-push a tag |
| `git tag -l 'v*' --sort=-v:refname` returns `v2026.07.23-0402` | Old desktop-era nightly tags (`v2026.06.18`–`v2026.07.23`) sort above `v0.x` | Ignore them; filter with `'v0.*' 'v[1-9].*'`. Never base the next version on a `v2026.*` tag |
