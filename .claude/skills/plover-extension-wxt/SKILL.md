---
name: plover-extension-wxt
description: Use when working in extension/ (WXT MV3 package), pnpm hangs on the corporate network, content script needs extension state, or when hitting 'Missing "./testing" specifier in "wxt" package' from vitest.config.ts, TS2304 "Cannot find name 'defineBackground'" / 'defineContentScript' / 'createShadowRootUi' or TS17004 "Cannot use JSX unless the '--jsx' flag is provided" from tsc, a missing extension/.wxt directory after the first pnpm add/install, or eslint "@typescript-eslint/no-empty-function" on defineBackground(() => {}).
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
| Calendar token parse returns null / interactive OAuth blocks every command | Implicit flow puts `access_token` in the URL fragment (`#`), not `?`; `calendar/connect` runs `launchWebAuthFlow` interactively for minutes | Parse `returned.split("#")[1]` with `URLSearchParams`; keep `calendar/connect` in `UNQUEUED_COMMANDS` and `enqueue` only the writes; alarm refresh uses `getCalendarToken(false)` plus a 10 s AbortController |
| `No projects matched the filters` for `pnpm --filter ./extension ...` | `./extension` resolves relative to cwd; shell was already inside `extension/` | Run from repo root, or inside `extension/` use `pnpm exec <tool>` |
| Content script can read the Supabase session; or buddy shows nothing / `storage.local` access errors in the content script | `storage.local` holds `sb-*-auth-token` and defaults to being readable from content scripts | Worker calls `browser.storage.local.setAccessLevel({ accessLevel: "TRUSTED_CONTEXTS" })` at startup (defense-in-depth only: support varies by browser, failure is just logged); content script reads only the slim `BuddySnapshot` over the `plover-state` port, never `storage.local` |
| Host page can read the password / task text typed into the in-page buddy panel | `createShadowRootUi` defaults to `mode: "open"` (`host.shadowRoot` is readable); key events bubble to page listeners anyway | Never render `Panel`/`SignIn` or user data in the content-script world. Blob uses `mode: "closed"`; the panel is `createIframeUi({ page: "/panel.html" })`, a cross-origin extension page that reads storage itself. `panel.html` must be in `web_accessible_resources` (`use_dynamic_url: true`) |
| TS2322 `"/panel.html"` not assignable to `HtmlPublicPath` | New entrypoint not in the generated types yet | `pnpm --filter ./extension exec wxt prepare` after adding `src/entrypoints/<name>/index.html` |
| Buddy stays "nudging" after the nudge window ended | Snapshot is pushed only on `storage.onChanged`; `nudgeUntil`/`celebrateUntil` expire with no storage write | `registerStatePort` re-posts with `setTimeout` at the earliest open window expiry |
| One test hangs and every later test in the same file times out | The command queue is module-global; a test that leaves a queued handler awaiting a never-resolved promise blocks `tail` for the whole file | Expected while RED; make network work unqueued, and resolve the pending promise (`finish(...)`) in the test before it ends |
| `action.openPopup` / `runtime.openOptionsPage` "not implemented" in tests | fakeBrowser stubs them as not-mocked | `Object.assign(fakeBrowser.action, { openPopup: vi.fn(...) })`; `fakeBrowser.notifications.onClicked.trigger(id)` works |
| Alarms `focus-nudge` / `calendar-refresh` / `calendar-headsup` missing after update or browser restart | Only the timer was reconciled on `onStartup`/`onInstalled` | `background/reconcile.ts`: queued timer + focus reconcile, then unqueued calendar refresh |
| `fakeBrowser.runtime.onConnect.trigger` is not a function / `addListener not implemented` | fakeBrowser has no in-memory `runtime.onConnect` | `vi.spyOn(fakeBrowser.runtime.onConnect, "addListener").mockImplementation(fn => void (onConnect = fn))` and call the captured listener with a stub port; `vi.restoreAllMocks()` afterwards |
| Settings/tasks arrive `undefined` in tests after `storage.local.get(keys)` | fakeBrowser returns missing keys as `undefined`, so `{ ...DEFAULT, ...stored }` overwrites defaults | Use `loadLocalState()` in `lib/storage.ts` (skips undefined values) |
| Buddy circle (56px) renders on the whole panel | Panel root class `plover-buddy` collided with the `Buddy` art class | Panel surface classes are `plover-surface-<surface>`; `plover-buddy*` is reserved for `Buddy` |
| `pnpm` hangs / ConnectTimeoutError on corporate network | corepack `pnpm` shim fetches from npm | `export PATH=~/Library/pnpm:$PATH` before pnpm commands (see `plover-pnpm-workspace`) |
| `sed -i 's/.../'` fails "undefined label" on macOS | BSD sed takes the next arg as the backup suffix | `sed -i '' 's/.../'` or edit with a script |

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

### Calendar OAuth (implicit flow) in the worker
**Symptom:** token never found after `launchWebAuthFlow`, or the whole command queue stalls while the consent window is open.
**Root cause:** Google's `response_type=token` redirect carries `#access_token=...&expires_in=...` (fragment). Interactive flows can take minutes.
**Fix:** `requestToken` in `lib/calendar/client.ts` parses the fragment; `calendar/connect` is unqueued and enqueues only the token/state writes. `launchWebAuthFlow` failures (closed window, interaction required) resolve to `null`, never throw.

### Content script must not read storage.local
**Symptom:** risk, not an error: any page-injected script context could read `sb-*-auth-token`.
**Root cause:** `storage.local` defaults to `TRUSTED_AND_UNTRUSTED_CONTEXTS`.
**Fix:** `setAccessLevel({ accessLevel: "TRUSTED_CONTEXTS" })` at the top of `defineBackground`, every start. Treat it as defense-in-depth, not a guarantee: browser support varies and a failure is only logged. The real protection is that the content script never touches `storage.local`: it gets `BuddySnapshot = { buddyState, nudgeText, checkInPending }` over a long-lived port (`plover-state`, built in `background/state-port.ts`), with no tasks, steps, calendar data or `sb-*` keys. `useBuddySnapshot()` reconnects on `onDisconnect` because the worker can be suspended. `storage.sync` settings stay directly readable/writable.

**Known, deferred:** every reconnect wakes the worker after it idles out. Accepted for now since the snapshot is tiny.

### In-page panel is an iframe, not shadow DOM
**Symptom:** risk: any page script could read `host.shadowRoot` input values (password, task text) from the old in-page `Panel`, and could click its buttons.
**Root cause:** WXT's `createShadowRootUi` defaults to `mode: "open"`; even a closed root lets key events bubble to page `window` listeners.
**Fix:** the blob shadow root uses `mode: "closed"` and only renders the blob, a bubble (nudge text / "Which step did you finish?") and the hide menu. The panel is `createIframeUi(ctx, { page: "/panel.html", position: "inline", anchor: "html" })`, mounted lazily on the first blob click and toggled with `wrapper.style.display` only from the content script's own blob/bubble click (no close button, never trust `window.postMessage` from the page). `panel.html` renders `<Panel surface="buddy" />` with direct storage reads like the popup. Verify with `grep -n "Panel\|SignIn" src/entrypoints/content/`.

### Keep network out of the command queue
**Symptom:** every command stalls while Supabase or Google is slow.
**Root cause:** `dispatch` serialises all non-`UNQUEUED_COMMANDS` through one promise chain; alarm handlers registered with `onAlarm` run inside it too.
**Fix:** add network-bound commands to `UNQUEUED_COMMANDS` (`auth/google`, `auth/password`, `auth/signOut`, `task/decompose`, `calendar/connect`) and `enqueue` only the storage writes; register network alarms with `onAlarm(name, fn, { queued: false })` (`calendar-refresh`). An unqueued function that enqueues must never be called from inside the queue: `calendar/connect` enqueues its writes, waits, then calls `refreshCalendar()` outside. Non-interactive `launchWebAuthFlow` gets `timeoutMsForNonInteractive: 10000`. The enqueued write re-checks `calendarConnected` so a disconnect during the fetch wins.
