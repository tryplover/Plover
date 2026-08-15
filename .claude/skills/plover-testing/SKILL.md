---
name: plover-testing
description: Use when writing or debugging Vitest tests in this repo and hitting "Cannot access 'mockVariable' before initialization" from vi.mock hoisting, EventEmitter.removeAllListeners not clearing all listeners, TS2532 "Object is possibly 'undefined'" combined with ESLint no-non-null-assertion in test files, "FOREIGN KEY constraint failed" on summaries.task_id inserts, needing to visually verify an Electron GUI change but Bash/PowerShell can't launch it, a sudden mass test failure where every failure bottoms out in "new Database(':memory:')" or better-sqlite3 throwing "was compiled against a different Node.js version" (Electron vs Node ABI) right after a pnpm dev session, "pnpm test" failing during the rebuild step itself with "EPERM: operation not permitted, unlink ...better_sqlite3.node" on Windows (a running pnpm dev session locks the file), or pre-existing failures in App.test.tsx / Onboarding.test.tsx (localStorage undefined, waitFor timeout on mockOnComplete).
---

# Plover Testing

## Overview
Footguns specific to writing and running Vitest tests in this repo: mocking pitfalls, TypeScript/ESLint interactions in test code, SQLite FK fixture setup, native-module ABI mismatches between `pnpm dev` and test runs, and which failures are pre-existing baseline noise vs. real regressions.

## Quick reference
| Symptom / error | Fix |
|---|---|
| `ReferenceError: Cannot access 'mockVariable' before initialization` | Declare mock vars with `vi.hoisted(...)`, not plain outer `const`/`let` |
| Listeners not cleared across tests despite calling `removeAllListeners()` | Branch on `event !== undefined`; call `removeAllListeners()` with no args to clear all |
| `TS2532: Object is possibly 'undefined'` on `result[0].kind`, and `result[0]!.kind` fails ESLint `no-non-null-assertion` | Destructure + optional chaining: `const [r0] = result; expect(r0?.kind).toBe(...)` |
| `SqliteError: FOREIGN KEY constraint failed` inserting a `summaries` row with `taskId` | Seed parent goal + task first (`GoalsRepo.create` → `TasksRepo.create`) before `SummariesRepo.insert` |
| Need to visually confirm a UI change but `pnpm dev` via Bash/PowerShell exits silently, no window, no process | Don't try — verify via `pnpm typecheck && pnpm lint && pnpm test` + diff read, or ask the user to run `pnpm dev` and look themselves |
| ~132 tests across ~22 files suddenly fail, all bottoming out at `new Database(':memory:')` in `better-sqlite3/lib/database.js`, or "was compiled against a different Node.js version" | Native module was last rebuilt for Electron's ABI by `pnpm dev`. Run `pnpm --filter ./app rebuild better-sqlite3 keytar` before testing, or just use root `pnpm test` (already does this) |
| `pnpm test` fails during the rebuild step itself with `gyp ERR! clean error` / `EPERM: operation not permitted, unlink ...better_sqlite3.node` or `...keytar.node` (Windows) | A live `pnpm dev` Electron session still has the native binary loaded/file-locked. Close the running `electron.exe`/`node.exe` processes (ask the user first — don't kill their dev session silently) before rerunning `pnpm test` |
| `tests/renderer/App.test.tsx` failing with `TypeError: Cannot read properties of undefined (reading 'setItem')`, or `Onboarding.test.tsx` failing on `waitFor` timeout for `mockOnComplete` | Pre-existing/environmental on `main`, unrelated to main-process changes — don't chase as a regression; confirm via `git diff --name-only main...HEAD \| grep -i renderer` |
| Suites fail as `FAIL tests/x.test.ts [ tests/x.test.ts ]` with zero tests run, error `Electron failed to install correctly` from `getElectronPath` | Electron's binary download (GitHub release CDN) failed at install; `electron/index.js` throws on import. `vitest.config.ts` aliases `electron` to `tests/stubs/electron.ts` so no suite loads the real module — if you see this again, confirm that alias is still present rather than re-running CI |
| Every suite fails at once with `There is not enough space on the disk` even though the repo's drive has plenty free | Vitest writes worker/transform files to Node's `os.tmpdir()` = `%TEMP%` on the **user profile** drive, regardless of where the repo lives. Check `Get-PSDrive C`, not the repo's drive. pnpm's store is configured separately (`pnpm store path`) and is NOT the culprit |

## Details

### vi.mock hoisted variable ReferenceError
**Symptom:** `ReferenceError: Cannot access 'mockVariable' before initialization` during Vitest runs.
**Root cause:** `vi.mock` is hoisted to the top of the file before outer variables are defined.
**Fix:** Use `vi.hoisted` to declare mock variables (e.g. `mockKeychain`, `mockOpenExternal`) so they are declared and initialized before any hoisted `vi.mock` blocks run.

### EventEmitter.removeAllListeners(undefined) does not clear all events
**Symptom:** A typed wrapper's `eventBus.removeAllListeners()` (passing `event?: string` value of `undefined` straight into Node's `emitter.removeAllListeners(event)`) fails to clear listeners across tests, causing multiple active listeners and cross-test failures.
**Root cause:** Node's `EventEmitter.prototype.removeAllListeners` checks `arguments.length` to decide whether to clear all events or just one. Passing `undefined` explicitly is still one argument — it's treated as event name `"undefined"`, not "no arguments."
**Fix:** Explicitly branch on `event !== undefined` and call `removeAllListeners()` with zero arguments to clear all events.

### noUncheckedIndexedAccess + no-non-null-assertion forces destructure pattern in tests
**Symptom:** Test code using `result[0].kind` fails typecheck with `TS2532: Object is possibly 'undefined'` (tsconfig has `noUncheckedIndexedAccess`). Switching to `result[0]!.kind` then fails ESLint `@typescript-eslint/no-non-null-assertion`.
**Root cause:** Both rules are intentionally on together. There is no non-null-assertion escape hatch; tests must be written so the type system can prove non-`undefined`.
**Fix:** Use the destructure + optional-chaining pattern already used in the codebase:
```ts
const result = repo.listSomething();
expect(result).toHaveLength(2);
const [r0, r1] = result;
expect(r0?.kind).toBe('file_added');
```
When `r0` is undefined, `r0?.kind` is `undefined` and the `toBe(...)` assertion fails — same semantics as `!.`, but lint-clean.

### summaries.task_id is a real FK; fixtures must seed the parent task
**Symptom:** Tests for `SummariesRepo.insert({ taskId: 'task-1', ... })` fail with `SqliteError: FOREIGN KEY constraint failed`.
**Root cause:** `summaries.task_id TEXT REFERENCES tasks(id) ON DELETE SET NULL` is a real foreign key. `task_id IS NULL` is allowed for "global" summaries, but any non-null value must reference an existing `tasks(id)` row. SQLite has foreign keys enabled in this app's migrations.
**Fix:** Seed the parent goal + task before inserting a summary with a non-null `taskId`. See the helper pattern in `app/tests/store/summaries-repo.test.ts` (`seedTask(db, taskId)` creates a goal via `GoalsRepo.create(...)` then a task via `TasksRepo.create(...)` with the desired id).

### Electron GUI can't be launched for visual verification via Bash/PowerShell
**Symptom:** Running `pnpm dev` (or directly launching the Electron binary) via the Bash/PowerShell tool, foreground or background, reports a clean exit code within seconds with no Electron process left running and zero stdout/stderr captured — no crash message, nothing.
**Root cause:** The Bash/PowerShell tool's shell runs in a sandboxed subprocess with no attached interactive desktop/window station. Electron needs a real window station to create a `BrowserWindow`; without one it exits immediately and silently before it can log anything. This context is also invisible to `computer-use` (which controls the user's actual visible desktop) — processes launched via Bash/PowerShell can't be screenshotted, and vice versa.
**Fix:** Don't try to visually verify Electron GUI changes by launching `pnpm dev`/the Electron binary through Bash/PowerShell and then screenshotting via `computer-use` — it silently fails with no diagnostic signal. Verify UI changes via `pnpm typecheck && pnpm lint && pnpm test`, a careful manual read of the diff, and (if genuinely needed) ask the user to run `pnpm dev` themselves and confirm visually on their own desktop session.

### running vitest right after pnpm dev fails every better-sqlite3 test (Electron vs Node ABI)
**Symptom:** After a `pnpm dev` session, running tests directly (`pnpm --filter ./app test` or `pnpm --filter ./app exec vitest run`) produces a huge, alarming failure count (~132 tests across ~22 files) — every failure bottoms out at `new Database(':memory:')` throwing inside `better-sqlite3/lib/database.js`; unrelated renderer tests appear to "fail" too because so many suites can't construct a DB.
**Root cause:** `pnpm dev` runs `npx @electron/rebuild -v <ver> -f -w better-sqlite3,keytar`, compiling native modules for **Electron's** V8/ABI. Vitest runs under plain **Node**, a different ABI, so `better-sqlite3` can't load and its constructor throws. The native module is one physical build in the pnpm store — dev and test want different ABIs for it, and whichever ran last wins.
**Fix:** Rebuild for Node before testing: `pnpm --filter ./app rebuild better-sqlite3 keytar`. Root `pnpm test` already prefixes this rebuild — use `pnpm test` / `pnpm --filter ./app run test` rather than invoking `vitest` directly, or you'll re-hit this every time you've just been in `pnpm dev`. When triaging a sudden mass test failure, check whether every error originates in a native module's constructor before assuming your change broke anything.

### rebuild step itself fails with EPERM/EBUSY unlinking the native binary (Windows)
**Symptom:** Root `pnpm test` fails before vitest even starts — the `pnpm --filter ./app rebuild better-sqlite3 keytar` prefix errors with `gyp ERR! clean error` / `Error: EPERM: operation not permitted, unlink '...\better-sqlite3\build\Release\better_sqlite3.node'` (and the same for `keytar.node`).
**Root cause:** On Windows, a file that's `dlopen`'d by a running process can't be deleted/overwritten. If a `pnpm dev` Electron session (main process + any child `electron.exe`/`node.exe`) is still running, it holds the native module file open, so node-gyp's clean step can't unlink it to write the new build.
**Fix:** Confirm with the user, then close the running dev session's processes (e.g. `taskkill //IM electron.exe //F` and `taskkill //IM node.exe //F` from Git Bash) before rerunning `pnpm test`. This is a different failure mode than the ABI-mismatch entry above — that one runs successfully and fails at test time; this one fails during the rebuild itself.

### renderer tests App.test.tsx + Onboarding.test.tsx currently fail on main (pre-existing)
**Symptom:** Even after the native-ABI rebuild above, a full `vitest run` shows 2 files / 8 tests failing: `tests/renderer/App.test.tsx` (all 4, `TypeError: Cannot read properties of undefined (reading 'setItem')` at `localStorage.setItem` in `beforeEach`) and `src/renderer/main/pages/Onboarding/Onboarding.test.tsx` (4, `waitFor` timeouts on `mockOnComplete`).
**Root cause:** Environmental/pre-existing on `main` — a jsdom `localStorage` setup gap and flaky async `waitFor` timing in renderer suites. Unrelated to main-process work: no renderer file imports `src/main/activity`, so activity/store/etc. refactors cannot cause them.
**Fix:** Don't chase these as regressions when your change is main-process-only. Confirm your diff touches no renderer files (`git diff --name-only main...HEAD | grep -i renderer`) and that renderer never imports your changed module, then treat the 2 red files as baseline. Making them green is a separate task: give the renderer vitest project a jsdom env with `localStorage` and stabilize the Onboarding `waitFor`s.

### A failed Electron binary download fails whole suites at collection
**Symptom:** Three suites (`commit-task-matcher`, `inference`, `planner-decompose`) fail in CI as `FAIL tests/activity/inference.test.ts [ tests/activity/inference.test.ts ]` — the bracketed form, meaning zero tests ran and there is no assertion to look at. The underlying error is `Error: Electron failed to install correctly. Please delete node_modules/electron ...` thrown from `getElectronPath` at `node_modules/electron/index.js:43`. Re-running the job "fixes" it, which makes it look like a flake.
**Root cause:** Under vitest the `electron` specifier does not resolve to the Electron API — in plain Node it resolves to the *path of a binary* that npm downloads from GitHub's release CDN during install, and `index.js` throws on import when that download failed (seen alongside `HTTPError: Response code 503` from that CDN). Any suite that transitively imports `electron` then dies at module load. Suites calling `vi.mock('electron', ...)` never load the real module and are immune — that split is exactly why the same three fail every time and the rest pass. Nothing is actually wrong with the tests.
**Fix:** `app/vitest.config.ts` aliases `electron` to `app/tests/stubs/electron.ts`, so no suite can load the real module. Nothing is lost — importers were only ever destructuring `undefined` off a string export — and suites that exercise Electron APIs still override it with `vi.mock('electron', ...)`. To reproduce the broken state locally, rename `node_modules/.pnpm/electron@<ver>/node_modules/electron/path.txt`; note pnpm's store is hardlinked, so restore it immediately and verify with `ls path.txt*` (a stale `path.txt.disabled` left behind will make a later experiment silently test the wrong condition).

### The whole suite dies on disk space even though the repo's drive is empty
**Symptom:** `pnpm test` reports `Failed Suites 66` — every suite in the project — with `There is not enough space on the disk.` The repo's drive (`D:`) shows 283 GB free, so the error looks nonsensical.
**Root cause:** Vitest forks workers that write transform caches and coverage intermediates to Node's `os.tmpdir()`. On Windows that resolves to `%TEMP%` under the *user profile* (`C:\Users\<user>\AppData\Local\Temp`), not the repo. The repo's location only determines where source and `node_modules` live. Confirm with `node -e "console.log(require('os').tmpdir())"`.
**Fix:** Check the profile drive (`Get-PSDrive C`), not the repo drive. Two caches look similar but are not interchangeable: pnpm's store (`pnpm store path`) **hardlinks into every `node_modules`**, so clearing it breaks every installed project — never delete it to reclaim space. The npm cache (`%LOCALAPPDATA%\npm-cache`) is only a download cache that npm copies out of, so clearing it is safe and on a pnpm-only repo it is pure dead weight (3.8 GB here). To stop it recurring, point `TMP`/`TEMP` at the roomy drive.
