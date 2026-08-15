---
name: plover-native-modules
description: Use when native module builds break in this repo — better-sqlite3 failing with "too few arguments to function call... v8::External::New", a runtime crash "was compiled against a different Node.js version", pnpm package failing with "Error: Cannot find module 'tslib'" (from @peculiar/utils / electron-builder), or before assuming an old CLAUDE.md Electron version pin is still accurate.
---

# Plover native module footguns

## Overview
Footguns from compiling native modules (`better-sqlite3`, `keytar`) against Electron's V8/ABI under a pnpm workspace, plus a tslib resolution gap in `electron-builder`, plus a superseded Electron version downgrade — always verify the currently pinned Electron version rather than trusting old advice.

## Quick reference
| Symptom / error | Fix |
|---|---|
| `better-sqlite3` fails with `too few arguments to function call... v8::External::New` | Native module compiled against wrong V8/ABI; recompile targeting the running Electron version with `@electron/rebuild` (see below) |
| Runtime crash: `was compiled against a different Node.js version` | Same ABI mismatch; rebuild native modules for the Electron version in use |
| `pnpm package` fails with `Error: Cannot find module 'tslib'` (via `@peculiar/utils`) | `pnpm add -D -w tslib` at the workspace root |
| Unsure which Electron version is pinned / old lesson says `^33.2.0` | Don't trust old notes — check directly: `grep '"electron"' app/package.json` |
| `pnpm dev` dies on launch: `The module ...better_sqlite3.node was compiled against a different Node.js version using NODE_MODULE_VERSION 146. This version of Node.js requires NODE_MODULE_VERSION 148` | The `dev` script's hardcoded `@electron/rebuild -v <ver>` drifted behind the installed Electron. As of better-sqlite3 13 there is no rebuild step at all — if you see one, delete it (see below) |
| `@electron/rebuild` fails with `Error: Could not find any Visual Studio installation to use` | node-gyp is trying to compile from source because no prebuild matches the target ABI. Don't install VS — use a native-module version that ships an N-API prebuild |
| `pnpm install` warns `Ignored build scripts: better-sqlite3@13.x` | Correct and intended. v13 ships prebuilds in the tarball; it must NOT be in `onlyBuiltDependencies` or pnpm auto-runs `node-gyp rebuild` on its `binding.gyp` and fails |
| A Dependabot bump to better-sqlite3 13 merges, then `pnpm install` fails with `gyp ERR! not ok` and 27 tests fail on `darwin-x64.node is not a valid Win32 application` | Dependabot changes the version only — it does not carry the v13 migration (drop from `onlyBuiltDependencies`, drop the rebuild prefixes from `test`/`test:coverage`, drop `@electron/rebuild` from `dev`, add `tests/setup.ts` + `setupFiles`). Check all four before assuming your branch broke; `gh run list --branch main` will show `main` already red |
| Tests fail with `...prebuilds\darwin-x64.node is not a valid Win32 application` | A test stubbed `process.platform` before the first `new Database()`. better-sqlite3 13 picks its prebuild from `process.platform` at that moment — `app/tests/setup.ts` constructs one first to pin the right binary |

## Details

### Native module compilation crash on Electron version bumps / ABI target mismatches
**Symptom:** Running `pnpm dev` fails to compile native modules (`better-sqlite3` fails with `too few arguments to function call... v8::External::New`), or hits a `was compiled against a different Node.js version` runtime crash.
**Root cause:** Electron version bumps (e.g. Dependabot bumping to Electron 42, which introduced V8 14.8) can break native binding APIs (`ExternalPointerTypeTag`) that older `better-sqlite3` versions rely on. Native modules must be compiled for the specific V8/ABI version of the running environment (Node.js's own ABI differs from whatever Electron version is pinned — e.g. Electron 33 used V8/ABI 130 vs. Node's 127). In a pnpm workspace, rebuilds run from subfolders can fail to target the physically-hoisted native modules in the parent `.pnpm` store.
**Fix (as previously applied, since partially superseded — see next entry):**
1. Pin `electron` to a version known compatible with the native module version in `app/package.json`.
2. Automate environment-targeted recompilation in root `package.json` scripts: prepend `npx @electron/rebuild -v <electron-version> -f -w better-sqlite3,keytar` to the root `dev` script, and `pnpm --filter ./app rebuild better-sqlite3 keytar` to the root `test` script.

### tslib required by electron-builder under pnpm workspaces
**Symptom:** Running `pnpm package` fails with `Error: Cannot find module 'tslib'` originating from `@peculiar/utils`.
**Root cause:** Under a pnpm workspace structure, dependencies of `electron-builder` (such as `@peculiar/webcrypto` and `@peculiar/utils`) require the helper module `tslib`, but it isn't resolved correctly due to pnpm's strict dependency isolation.
**Fix:** Install `tslib` as a dev dependency at the workspace root: `pnpm add -D -w tslib`.

### `app/package.json` pins Electron `^42.7.0`, NOT `^33.2.0` — the earlier downgrade is superseded
**Symptom:** None directly — this is a trap for trusting stale advice. An earlier fix (above) downgraded Electron to `^33.2.0` to resolve a `better-sqlite3`/V8 ABI mismatch. That downgrade has since been reverted/superseded: as of 2026-07-21, `app/package.json` pins `^42.7.0`.
**Root cause:** Documentation/notes describing a past fix can go stale after a subsequent, undocumented revert. If you hit native-module ABI errors again, assuming the old `^33.2.0` pin is still in place will misdiagnose the problem.
**Fix:** Always check the actual pinned version first before acting on old advice: `grep '"electron"' app/package.json`. Target `@electron/rebuild` and any version-specific fix at whatever version is actually pinned, not at what an older note says.

### better-sqlite3 12 needs a per-ABI rebuild; 13 is N-API and needs none
**Symptom:** A chain of failures after an Electron major bump: `pnpm dev` crashes with `NODE_MODULE_VERSION 146 ... requires 148`; fixing the `dev` script's `-v` pin then makes `@electron/rebuild` fail with `Could not find any Visual Studio installation to use`; and `pnpm update better-sqlite3` reports nothing to update.
**Root cause:** Three separate things stacked up.
1. The root `dev` script hardcoded `npx @electron/rebuild -v 42.5.1`, which silently drifts every time Dependabot bumps Electron. Nothing validates the two agree.
2. better-sqlite3 **12.x** ships one prebuild *per ABI*, and its GitHub releases stop at `electron-v146` (Electron 42). Electron 43 is ABI 148, so there is no prebuild and node-gyp falls back to compiling — which needs a Visual Studio toolchain on Windows.
3. `12.11.2` and `12.12.0` *do* have `electron-v148` assets on GitHub but were **never published to npm** — npm's 12.x line ends at `12.11.1`. So the semver range has nothing to resolve to, and `pnpm update` correctly does nothing.
**Fix:** Upgrade to better-sqlite3 **13.x**, which is N-API (`node-addon-api`) and ships one prebuild *per platform* (`prebuilds/win32-x64.node`), ABI-stable across both Node and Electron. Then:
- Remove `better-sqlite3` from `onlyBuiltDependencies` in `pnpm-workspace.yaml`. It has no `install` script, but it does ship a `binding.gyp`, and pnpm auto-runs `node-gyp rebuild` for any allowed dependency that has one — which fails without Visual Studio. The resulting `Ignored build scripts` warning is the correct end state.
- Drop `@electron/rebuild` from the root `dev` script and the `pnpm --filter ./app rebuild better-sqlite3 keytar` prefix from `test` / `test:coverage`. Nothing needs rebuilding any more, which also removes the dev/test ABI seesaw entirely and cut the suite from ~43s to ~13s.
- Keep `keytar` in `onlyBuiltDependencies`: it ships a `napi-v3` prebuild (also ABI-stable) but its `install` script has to run to fetch it.

### better-sqlite3 13 resolves its prebuild from process.platform at first construction
**Symptom:** After upgrading to better-sqlite3 13, 27 tests across `tests/activity/screen-capturer.test.ts` and `tests/activity/window-tracker.test.ts` fail with `\?\D:\...\prebuilds\darwin-x64.node is not a valid Win32 application`.
**Root cause:** Those suites do `Object.defineProperty(process, 'platform', { value: 'darwin' })` in `beforeEach` to exercise macOS paths, then build a DB. v13's `lib/binding.js` `getBinding()` reads `process.platform` to pick `prebuilds/<platform>-<arch>.node`, caching it in `DEFAULT_ADDON`. It runs **lazily on the first `new Database()`**, not at import — so merely importing the module in a setup file does not pin it.
**Fix:** `app/tests/setup.ts` (wired via `setupFiles` in `vitest.config.ts`) constructs and closes a throwaway `new Database(':memory:')`, forcing the real platform's binary to be cached before any test file can stub `process.platform`. v12 was immune to this because `bindings` located a compiled `build/Release/better_sqlite3.node` regardless of platform.

### A Dependabot major bump silently re-breaks the better-sqlite3 13 migration
**Symptom:** On a branch that merged current `main`, `pnpm install` dies with `gyp ERR! not ok` building `better-sqlite3@13.0.3`; after working around that, 27 tests fail across `window-tracker.test.ts` and `screen-capturer.test.ts` with `prebuilds\darwin-x64.node is not a valid Win32 application`. Easy to misread as damage from your own merge conflict resolution.
**Root cause:** The v13 migration documented above is four coordinated changes — remove `better-sqlite3` from `onlyBuiltDependencies`, strip the `rebuild better-sqlite3 keytar` prefix from the root `test`/`test:coverage` scripts, drop `@electron/rebuild` from `dev`, and add `app/tests/setup.ts` + `setupFiles`. Dependabot's PR (#357) bumped only the version string in `app/package.json`, leaving all four undone, and merged with red CI. So `main` itself carries a config that instructs pnpm to compile v13 from source (needs Visual Studio) and a test suite with no platform-pinning setup file.
**Fix:** Before debugging your own branch, check whether `main` is already broken: `gh run list --branch main --limit 5 --json displayTitle,conclusion`. If it is, the redness is inherited — say so rather than absorbing an unrelated repo-wide fix into a scoped PR. To unblock local verification without polluting the branch, temporarily drop `better-sqlite3` from `pnpm-workspace.yaml`, install, run `cd app && pnpm exec vitest run` (bypassing the root `test` script's stale rebuild prefix), then `git checkout -- pnpm-workspace.yaml` before committing. The real fix belongs in its own PR.
