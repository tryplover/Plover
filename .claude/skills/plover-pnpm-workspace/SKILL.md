---
name: plover-pnpm-workspace
description: Use when pnpm commands in this repo fail or behave unexpectedly — "No projects matched the filters", a colon-named script (e.g. test:coverage) not running under --filter, vitest --coverage producing no coverage output when passed after a trailing --, "Ignored build scripts" / esbuild binary not built after pnpm install, pnpm hanging/erroring with "ConnectTimeoutError" or a fetch to registry.npmjs.org/pnpm on a corporate/VPN-restricted network, or `pnpm test` failing with "ERR_PNPM_UNEXPECTED_STORE".
---

# Plover pnpm workspace footguns

## Overview

Footguns specific to running pnpm in this repo's workspace (`extension/` package, pnpm 10+, corepack-managed). Covers filter syntax, colon-named scripts, flag forwarding, postinstall gating, and corepack network failures.

## Quick reference

| Symptom / error                                                                                                                      | Fix                                                                                                                                                                                                                                  |
| ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `pnpm -F extension typecheck` → `No projects matched the filters`                                                                    | Use path-based filter: `pnpm --filter ./extension typecheck` (don't rely on the package name)                                                                                                                                        |
| `pnpm --filter ./extension test:coverage` → `No projects matched the filters in <repo>`                                              | Add explicit `run`: `pnpm --filter ./extension run test:coverage`                                                                                                                                                                    |
| `pnpm --filter ./extension test -- --coverage` runs tests but produces no coverage output                                            | Don't forward flags through `--`; use the dedicated `test:coverage` script in `extension/package.json` (`vitest run --coverage` directly)                                                                                            |
| `pnpm install` warns `Ignored build scripts`; `esbuild` binary not built                                                             | Add package to `onlyBuiltDependencies` in `pnpm-workspace.yaml`                                                                                                                                                                      |
| `pnpm <anything>` → `Error when performing the request to https://registry.npmjs.org/pnpm/-/pnpm-10.26.0.tgz`, `ConnectTimeoutError` | Use global pnpm directly, not the corepack shim: `export PATH=~/Library/pnpm:$PATH` then `pnpm install`                                                                                                                              |
| `pnpm test` (root) fails with `ERR_PNPM_UNEXPECTED_STORE`                                                                            | A non-corepack `pnpm` (e.g. Homebrew's, earlier on `$PATH`) shadows the pinned `packageManager` version; run `export PATH=~/Library/pnpm:$PATH` first so the correct pnpm (matching `packageManager` in root `package.json`) is used |

## Details

### Filters must be path-based, not by name

**Symptom:** `pnpm -F <dir-name> typecheck` -> `No projects matched the filters`.
**Root cause:** `pnpm -F <name>` matches by package **name**, not directory.
**Fix:** Use the path-based filter `pnpm --filter ./extension <script>`. Refactor-safe; root scripts and CI use this form.

### Colon-named scripts need explicit `run` under `--filter`

**Symptom:** `pnpm --filter ./extension test:coverage` → `No projects matched the filters in <repo>`, even though `pnpm --filter ./extension typecheck` works.
**Root cause:** pnpm treats script names containing `:` as a special case (prefix-based dispatch across packages), and the matcher interacts oddly with `--filter`. The error message is misleading — the filter is fine; pnpm just won't run the colon-script through the filter shortcut.
**Fix:** Use the explicit `run` keyword: `pnpm --filter ./extension run test:coverage`. CI uses this form. Locally, either form works for non-colon scripts.

### `vitest` doesn't see `--coverage` when passed via pnpm `--`

**Symptom:** `pnpm --filter ./extension test -- --coverage` ran the tests but produced no coverage output. The resolved command was `vitest run -- --coverage` — the flag arrived as a positional after `--`, not as a CLI flag.
**Root cause:** With pnpm + workspace filter, the trailing `--` separator doesn't reliably forward subsequent args as flags to the underlying tool. vitest treats `--coverage` as a (nonexistent) positional spec.
**Fix:** Add a dedicated `test:coverage` script in `extension/package.json` that calls `vitest run --coverage` directly. CI and humans use that script. Don't try to forward flags through `pnpm run` for tooling that has its own CLI.

### Postinstall is gated by pnpm 10's `onlyBuiltDependencies`

**Symptom:** After `pnpm install`, the `esbuild` binary wasn't built; pnpm warned `Ignored build scripts`.
**Root cause:** pnpm 10+ requires explicit allowlisting of packages whose postinstall scripts may run.
**Fix:** `pnpm-workspace.yaml` lists them under `onlyBuiltDependencies` (currently `esbuild`). Add new packages there as they're introduced.

### Corepack-based pnpm shim breaks behind corporate npm registry

**Symptom:** `pnpm <anything>` fails with `Error when performing the request to https://registry.npmjs.org/pnpm/-/pnpm-10.26.0.tgz` / `ConnectTimeoutError`, even when `~/.npmrc` already points to an internal registry. Background subagents and the main session both hit the same wall.
**Root cause:** The `pnpm` on `$PATH` (via Node/mise) is actually a corepack shim that ignores user `.npmrc` and unconditionally fetches the pinned `packageManager` version from `registry.npmjs.org`. On a network without direct access to `registry.npmjs.org` (VPN-only, corporate restriction), corepack times out before `.npmrc` is even consulted.
**Fix:** Use the previously-installed global pnpm directly: `~/Library/pnpm/pnpm` (or wherever `pnpm setup` placed it). Prepend it to `PATH` so subprocesses (including scripts that re-shell out to `pnpm`) resolve to the global binary rather than the corepack shim:

```sh
export PATH=/Users/<user>/Library/pnpm:$PATH
pnpm install   # now actually uses the internal registry from ~/.npmrc
```

Subagents that need to install deps will hit this same wall and report "network/corepack issue" — orchestrator must pre-install deps from the main session or pass the PATH override into the subagent prompt.

### A stray Homebrew `pnpm` on `$PATH` fails with `ERR_PNPM_UNEXPECTED_STORE`

**Symptom:** `pnpm test` from repo root fails before running any tests: `ERR_PNPM_UNEXPECTED_STORE`, pnpm wants a different store version than the one `node_modules` is linked from.
**Root cause:** Root `package.json` pins `"packageManager": "pnpm@10.26.0"`, but a separately-installed older `pnpm` (e.g. Homebrew's) earlier on `$PATH` runs instead.
**Fix:** Put the correct global pnpm first: `export PATH=/Users/<user>/Library/pnpm:$PATH`. Verify with `pnpm --version` before trusting a result.
