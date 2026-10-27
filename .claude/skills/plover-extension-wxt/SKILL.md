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
| Alarm/message handlers silently stop firing in tests after the first test | `fakeBrowser.reset()` removes all event listeners, including the `alarms.onAlarm` router | Re-register in `beforeEach` after reset; `onAlarm()` in `background/alarms.ts` re-adds the router when `hasListener` is false |
| `TypeError: object is not iterable` from `Promise.all(fakeBrowser.alarms.onAlarm.trigger(...))`; TS2345 missing `persistAcrossSessions` | `trigger()` already returns a Promise; `Alarm` requires `persistAcrossSessions` | `await fakeBrowser.alarms.onAlarm.trigger({ name, scheduledTime, persistAcrossSessions: false })` |
| Previously green dispatch tests fail with `supabaseUrl is required` or `not signed in` | `dispatch` gates `GATED_COMMANDS` via `isSignedIn()`, which builds a real Supabase client (env vars are empty in tests) | In tests of gated commands: `vi.mock("@/lib/auth/session", async (orig) => ({ ...(await orig<typeof import("@/lib/auth/session")>()), isSignedIn: async () => true }))` |
| TS2322 on `declarativeNetRequest` rule literals (`type: "redirect"`, `resourceTypes: ["main_frame"]`) | `@types/chrome` models these as enums, string literals are not assignable | Cast: `"main_frame" as chrome.declarativeNetRequest.ResourceType`, `"redirect" as chrome.declarativeNetRequest.RuleActionType` |
| `browser.declarativeNetRequest` undefined in tests | `fakeBrowser` does not implement it | In `beforeEach`: `(fakeBrowser as unknown as Record<string, unknown>).declarativeNetRequest = { updateDynamicRules: vi.fn(), getDynamicRules: vi.fn(async () => []) }`; `vi.spyOn(fakeBrowser.tabs, "query")` for tabs |
| `No projects matched the filters` for `pnpm --filter ./extension ...` | `./extension` resolves relative to cwd; shell was already inside `extension/` | Run from repo root, or inside `extension/` use `pnpm exec <tool>` |

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

### fakeBrowser reset drops listeners; trigger is async
**Symptom:** the second and later tests never see alarm handlers run; or `Promise.all(trigger(...))` throws "object is not iterable".
**Root cause:** `fakeBrowser.reset()` calls `removeAllListeners()` on every event; `trigger()` returns one awaited Promise, not an array.
**Fix:** register handlers (`registerTimerHandlers()` etc.) in `beforeEach` after `reset()`, and `await fakeBrowser.alarms.onAlarm.trigger(alarm)`. Use `vi.useFakeTimers({ toFake: ['Date'] })` plus `vi.setSystemTime` for time; fakeBrowser alarms read `Date.now()`.

### Sign-in gate breaks tests of gated commands
**Symptom:** timer/task/focus tests that dispatch `timer/start`, `task/save`, etc. fail with `supabaseUrl is required` or `{ ok: false, error: 'not signed in' }`.
**Root cause:** `dispatch` in `background/controller.ts` checks `isSignedIn()` for every type in `GATED_COMMANDS`; `getSupabase()` reads `import.meta.env.WXT_SUPABASE_*`, empty under Vitest.
**Fix:** mock `isSignedIn` (see table) or mock `@supabase/supabase-js` with `vi.hoisted` and stub `auth.getSession`. Never `await dispatch()`/`enqueue()` from inside a handler or alarm/timer listener: they run inside the single queue and would deadlock.

### Path filters are cwd-relative
**Symptom:** `No projects matched the filters` for `pnpm --filter ./extension exec vitest ...`.
**Root cause:** `./extension` is resolved from the current directory; after `cd extension` it does not exist.
**Fix:** run filtered commands from the repo root, or use plain `pnpm exec <tool>` inside `extension/`.
