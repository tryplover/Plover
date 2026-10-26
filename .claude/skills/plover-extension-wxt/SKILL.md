---
name: plover-extension-wxt
description: Use when working in extension/ (WXT MV3 package) and hitting 'Missing "./testing" specifier in "wxt" package' from vitest.config.ts, TS2304 "Cannot find name 'defineBackground'" / 'defineContentScript' / 'createShadowRootUi' or TS17004 "Cannot use JSX unless the '--jsx' flag is provided" from tsc, a missing extension/.wxt directory after the first pnpm add/install, or eslint "@typescript-eslint/no-empty-function" on defineBackground(() => {}).
---

# Plover extension (WXT) footguns

## Overview
Footguns specific to `extension/` (package `plover-extension`, WXT 0.21, Vitest 4, React 18).

## Quick reference
| Symptom / error | Cause | Fix |
|---|---|---|
| `Missing "./testing" specifier in "wxt" package` loading vitest.config.ts | Wrong import path | `import { WxtVitest } from 'wxt/testing/vitest-plugin'` |
| TS2304 `Cannot find name 'defineBackground'` / `createShadowRootUi` | tsconfig `include` override lists `.wxt/wxt.d.ts`; tsc skips dot-dir files, so auto-import globals are not loaded | Remove `include`/`exclude` from `extension/tsconfig.json`; inherit from `./.wxt/tsconfig.json` |
| TS17004 `Cannot use JSX unless the '--jsx' flag` | `.wxt/tsconfig.json` sets no `jsx` | Add `"jsx": "react-jsx"` to compilerOptions |
| No `extension/.wxt` after first `pnpm add` | `postinstall: wxt prepare` ran before `wxt.config.ts` existed | Run `pnpm --filter ./extension exec wxt prepare` once (later installs and CI are fine) |
| eslint `no-empty-function` on `defineBackground(() => {})` | typescript-eslint strict | Use `defineBackground(() => undefined)` |

## Details

### Vitest plugin import path
**Symptom:** `failed to load config ... Missing "./testing" specifier in "wxt" package`.
**Root cause:** wxt exports only `wxt/testing/vitest-plugin` and `wxt/testing/fake-browser`.
**Fix:** `import { WxtVitest } from 'wxt/testing/vitest-plugin'`.

### tsconfig include breaks WXT auto-imports
**Symptom:** `pnpm --filter ./extension typecheck` reports TS2304 for `defineBackground`, `defineContentScript`, `createShadowRootUi`, plus implicit-any on callbacks.
**Root cause:** `extension/tsconfig.json` overrode `include` with `.wxt/wxt.d.ts`; tsc did not pick up that dot-directory file, so the generated global declarations were never loaded. The generated `.wxt/tsconfig.json` already includes `../**/*` and `./wxt.d.ts`.
**Fix:** drop `include`/`exclude`, keep only strict flags and `jsx: react-jsx`, and `types: ["chrome"]`.

### wxt prepare on first install
**Symptom:** `extension/.wxt` missing, typecheck fails with "File '.wxt/tsconfig.json' not found".
**Root cause:** the `postinstall` script ran at `pnpm add` time, before `wxt.config.ts` existed.
**Fix:** run `pnpm --filter ./extension exec wxt prepare` once; CI is fine because config exists by then.

### no-empty-function
**Symptom:** `@typescript-eslint/no-empty-function` on a stub `defineBackground(() => {})`.
**Fix:** return `undefined` explicitly: `defineBackground(() => undefined)`.
