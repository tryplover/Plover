# Auto-heal Dependabot PRs so they pass CI and auto-merge

**Date:** 2026-06-05
**Status:** Design

## Context

Every Dependabot PR currently fails CI on this repo, so the existing auto-merge
action ([.github/workflows/dependabot-automerge.yml](../../../.github/workflows/dependabot-automerge.yml),
using `fastify/github-action-merge-dependabot@v3`) never fires. The PR queue
accumulates noise (7 open Dependabot PRs as of writing: #53–#59).

**Root cause** (confirmed via `gh run view 26854865809 --log-failed` on PR #53):

```
ERR_PNPM_OUTDATED_LOCKFILE  Cannot install with "frozen-lockfile"
because pnpm-lock.yaml is not up to date with <ROOT>/app/package.json
```

Dependabot updates `app/package.json` with new version pins but does **not**
regenerate `app/pnpm-lock.yaml`. CI's `pnpm install --frozen-lockfile`
(Linux ubuntu-latest, pnpm v10, Node 22 — see
[.github/workflows/ci.yml:21-49](../../../.github/workflows/ci.yml)) then
rejects the install.

All 7 currently-open Dependabot PRs fail with this same error. Older PRs
(#40–#47) merged fine, so something changed — most likely a pnpm v10
lockfile-format upgrade that Dependabot's internal pnpm can no longer
regenerate, made worse by the root `package.json` not declaring a
`packageManager` field.

Secondary risk (per CLAUDE.md lessons-learned): even once lockfiles regenerate,
two classes of "CI-pass-but-app-break" bumps must be blocked:

- **react / react-dom skew** (2026-05-31 lesson) — react-dom 19 with react 18
  crashes the renderer with `Cannot read properties of undefined (reading 'S')`.
  PRs #54 and #59 bump react-dom while react stays on 18; both would auto-merge
  today if CI passed.
- **electron majors** (2026-05-31 lesson) — electron 42 broke `better-sqlite3`
  against V8 14.8. PR #47 already merged the 33→42 jump and required a
  follow-up fix in commit `52ba2d6`.

**Intended outcome:** Dependabot PRs either pass CI and auto-merge on their
own, or get silently held back by config rules. No manual intervention, no PR
queue clutter.

## Approach

Three layered fixes — small config tweaks first, workflow last.

### Fix 1 — Pin pnpm via `packageManager` field

Add `"packageManager": "pnpm@10.<exact>"` to the root
[package.json](../../../package.json). The exact version to pin: read
`pnpm --version` on the maintainer machine and use that (it must match CI's
`pnpm/action-setup` `version: 10` resolution).

Why: Dependabot reads `packageManager` to choose which pnpm to invoke when
regenerating lockfiles. Without it, Dependabot's default pnpm may be too old
to write a pnpm-v10-format lockfile, so it skips the lockfile update entirely.
This alone may fix the entire problem.

### Fix 2 — Self-healing lockfile workflow (safety net)

New file `.github/workflows/dependabot-lockfile-fix.yml`:

- **Trigger:** `pull_request` event, gated by
  `github.actor == 'dependabot[bot]'`.
- **Permissions:** `contents: write`, `pull-requests: write`.
- **Steps:**
  1. `actions/checkout@v4` with `ref: ${{ github.event.pull_request.head.ref }}`
     and `token: ${{ secrets.DEPENDABOT_LOCKFILE_PAT }}` (see "Token note"
     below).
  2. Install `libsecret-1-dev` (mirrors ci.yml so postinstall scripts succeed).
  3. `pnpm/action-setup@v4` with `version: 10`.
  4. `actions/setup-node@v4` with `node-version-file: .nvmrc` and
     `cache: 'pnpm'`.
  5. `pnpm install --lockfile-only` (regenerates root + app lockfiles without
     running install scripts — ~10s).
  6. If `git diff --quiet pnpm-lock.yaml app/pnpm-lock.yaml` shows changes:
     set git author to `dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>`,
     commit `chore: regenerate pnpm lockfile`, then `git push`.

**Token note:** pushes made by the default `GITHUB_TOKEN` do **not** trigger
downstream workflows, so CI would never re-run. Use a fine-grained PAT
(repo-scoped, `Contents: write` + `Pull requests: write`) stored as repo
secret `DEPENDABOT_LOCKFILE_PAT`. Owner creates it once. Alternative if PAT
is undesirable: a GitHub App token via `tibdex/github-app-token@v2` — more
setup, not worth it for a hackathon repo.

### Fix 3 — Tighten Dependabot config

Edit [.github/dependabot.yml](../../../.github/dependabot.yml). For the `npm`
entry on `/app`:

- Add a `react-ecosystem` group capturing `react`, `react-dom`,
  `@types/react`, `@types/react-dom` (forces lockstep bumps; prevents the
  v18/v19 skew).
- Add `ignore` rules:
  - `react`, `react-dom`, `@types/react`, `@types/react-dom`: ignore
    `version-update:semver-major` — gate react-19 migration on a manual
    decision.
  - `electron`: ignore `version-update:semver-major` — gate electron-34+ on
    manual native-module validation (electron 33 was deliberately pinned).

The existing `minor-and-patch` group stays as the catch-all.

### One-time cleanup of stuck PRs

After Fixes 1+3 land on `main`, the 7 stuck PRs still have stale lockfiles:

1. Comment `@dependabot recreate` on PR #53 first to validate the new pipeline
   end-to-end (expect lockfile-fix → CI green → auto-merge in 3–5 minutes).
2. Then `@dependabot recreate` on PR #55.
3. PRs #54, #57, #58, #59 are majors that the new ignore rules will close
   automatically — Dependabot drops PRs whose updates become ignored.

## Files to modify

- `package.json` (root) — add `packageManager: "pnpm@10.<exact>"`.
- `.github/dependabot.yml` — add `react-ecosystem` group + major-version
  ignore rules for the react family and electron, under the existing `/app`
  npm entry.
- `.github/workflows/dependabot-lockfile-fix.yml` — new file, ~40 lines.

No existing workflow modifications. [ci.yml](../../../.github/workflows/ci.yml)
and [dependabot-automerge.yml](../../../.github/workflows/dependabot-automerge.yml)
are untouched — they already work correctly once CI can go green.

Reused tooling: same `libsecret-1-dev` apt step from ci.yml; same
`pnpm/action-setup@v4` and `actions/setup-node@v4` versions; same Node from
`.nvmrc`.

## Verification

1. **Local sanity:** run `pnpm install --lockfile-only` from repo root,
   confirm `app/pnpm-lock.yaml` regenerates without errors and
   `pnpm typecheck && pnpm lint && pnpm test` still pass.
2. **PAT setup:** confirm `DEPENDABOT_LOCKFILE_PAT` is set in repo secrets
   (Settings → Secrets and variables → Actions) before merging Fix 2.
3. **Dry-run on PR #53:**
   - After merging Fixes 1–3 to main, comment `@dependabot recreate` on PR #53.
   - Watch with `gh pr checks 53 --repo GetPlover/Plover --watch`.
   - Expect: new `dependabot-lockfile-fix` workflow runs → lockfile commit
     pushed → `ci.yml` re-runs on that commit → auto-merge fires. ~3–5 min.
4. **Confirm major-ignore behavior:** check that PRs #56, #57, #58 get closed
   automatically by Dependabot within a few minutes of `dependabot.yml`
   hitting main (Dependabot reconciles open PRs against new config on push
   to default branch).
5. **Steady-state check:** wait for next Monday's Dependabot batch and
   confirm PRs land green without manual touch.

If Fix 1 alone resolves things (lockfiles regenerate on Dependabot's side),
Fix 2's workflow becomes a no-op safety net — that's fine, leave it in place.
