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
