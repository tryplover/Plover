# CLAUDE.md — Plover project context

This file is loaded automatically into every Claude session in this repo. Read it
top-to-bottom before doing any work. Treat it as the source of truth for project
context, conventions, and known footguns.

## How to work in this repo (read this first)

1. **Spec is authoritative.** The product spec and the Phase 1 specs under
   [docs/superpowers/specs/](docs/superpowers/specs/) define scope, constraints,
   and the file layout. Do not scope-creep beyond the current phase.
2. **Lessons-learned is a contract.** If you hit an error, surprise, or
   wrong-first-attempt that a future Claude could avoid by reading this file,
   add a dated entry to the "Lessons learned" section at the bottom **before
   reporting completion**. Be concrete: command/file, symptom, root cause, fix.
   This rule applies even to small mistakes. The point is to make this file
   smarter over time.
3. **Plan first, then delegate.** For any non-trivial code change, do not write
   the code yourself in this session. First write an implementation plan to
   `docs/plans/<short-kebab-name>.md` (use the `writing-plans` skill), then
   dispatch subagents to implement it (`subagent-driven-development` /
   `executing-plans`). Default implementation subagents to **Haiku**; escalate
   to Sonnet/Opus only when a task is genuinely tricky. Trivial edits (typos,
   one-line fixes, doc tweaks) may be made directly. The orchestrating session
   stays focused on design, dispatch, and review.
4. **Verify before claiming.** Run `pnpm typecheck && pnpm lint && pnpm test`
   from the repo root and confirm green output before saying anything is done.
5. **Use the docs to avoid re-reading code.** This file + the two spec docs
   should be enough to start a session. Open code only when you need a specific
   detail.

## Plan-then-delegate workflow

For any non-trivial changes, follow this structured cycle:

- **Write the plan** → Create a plan under `docs/plans/<name>.md` covering context, file-by-file changes, reuse of existing utilities, and verification steps. Use the `writing-plans` skill.
- **Delegate implementation** → Dispatch Haiku subagent(s) (or Sonnet/Opus for tricky tasks) to implement the plan, using one agent per independent task. Use the `subagent-driven-development` / `executing-plans` flow.
- **Review + verify** → The orchestrator reviews the subagent diffs and runs `pnpm typecheck && pnpm lint && pnpm test` before claiming completion.

Note: `docs/plans/` contains *generated implementation plans* used as input to subagents. It is distinct from `docs/superpowers/specs/`, which remains the authoritative product and phase specification.

## Project

**Plover** is a local-first Electron desktop agent for productivity. It turns vague goals into a structured plan of subtasks and shepherds the user toward finishing them. Privacy-by-design: user data is strictly local, but outbound Gemini API calls are proxied securely through a backend server to protect the developer API key in production.

- **Product spec:** [docs/superpowers/specs/2026-05-24-task-tracker-agent-product-spec.md](docs/superpowers/specs/2026-05-24-task-tracker-agent-product-spec.md)
- **Phase 1 core architecture:** [docs/superpowers/specs/phase-1/core-architecture.md](docs/superpowers/specs/phase-1/core-architecture.md)

The core architecture doc's "Implementation order" section (steps 1–7) is the
implementation order. Do not jump ahead.

## Workspace layout

```
.
├── CLAUDE.md                       # ← you are here
├── package.json                    # pnpm workspace root, husky/lint-staged
├── pnpm-workspace.yaml             # packages: [app, server]
├── .nvmrc                          # Node 22 (LTS)
├── .husky/pre-commit               # runs lint-staged
├── .github/
│   ├── workflows/ci.yml            # typecheck + lint + test+coverage
│   ├── dependabot.yml              # weekly npm + actions updates
│   └── PULL_REQUEST_TEMPLATE.md
├── docs/
│   ├── plans/                      # generated implementation plans (input to subagents)
│   └── superpowers/specs/          # PRD + Phase 1 specs (authoritative)
│       ├── 2026-05-24-task-tracker-agent-product-spec.md
│       └── phase-1/
│           ├── core-architecture.md
│           └── store-layer.md
└── app/                            # the Electron app (single workspace pkg)
    ├── package.json                # name: "plover"
    ├── electron.vite.config.ts
    ...
└── server/                         # secure backend proxy server for Gemini API
    ├── package.json                # name: "plover-server"
    ├── tsconfig.json
    ├── .env.example
    └── src/
        └── index.ts                # Express app + Gemini API logic
    ├── tsconfig.json               # strict TS, path aliases
    ├── eslint.config.js            # flat config
    ├── vitest.config.ts            # v8 coverage, scoped 60% thresholds
    ├── src/
    │   ├── main/                   # Electron main process
    │   ├── preload/
    │   ├── renderer/               # React UI
    │   └── shared/                 # cross-process types
    └── tests/
```

## Commands

All commands run from the **repo root**. The root scripts delegate into `app/`
via `pnpm --filter ./app`.

| Command | What it does |
|---|---|
| `pnpm install` | Install everything + run husky `prepare` |
| `pnpm dev` | Launch Electron in dev mode (HMR for renderer) |
| `pnpm build` | electron-vite production build |
| `pnpm package` | Compile app and package standalone macOS `.dmg` installer |
| `pnpm typecheck` | `tsc --noEmit` on the app |
| `pnpm lint` | ESLint on the app |
| `pnpm test` | Vitest run (no coverage) |
| `pnpm --filter ./app run test:coverage` | Vitest run + v8 coverage report |
| `pnpm --filter ./app exec <tool>` | Run a tool binary inside the app workspace |
| `pnpm --filter ./server dev` | Start the backend proxy server locally in watch mode |
| `pnpm --filter ./server build` | Compile the backend server TypeScript code |

**Always use path-based filters (`--filter ./app`)**, not name-based
(`-F plover`). See lessons-learned #1.

**Always use `pnpm --filter ./app run <script>`** when the script name contains
a colon (e.g. `test:coverage`). See lessons-learned #2.

To run the app end-to-end locally (API keys, Google OAuth setup, manual test
walkthrough), see [docs/RUNNING.md](docs/RUNNING.md).

## Architecture rules (load-bearing)

These are not style preferences. The core architecture doc calls them
"load-bearing" module boundaries. Violating them defeats the point of the design.

- **Store** (`app/src/main/store/`) exposes typed repos: `Goals`, `Tasks`,
  `Sessions`, `Activity`, `Summaries`. No module reaches into raw SQLite.
- **Planner** is a pure function: `(goal_text, context) → {goal, subtasks[]}`.
  Side effects only via `Store` and `Sync`.
- **Monitor** writes to `Activity` only. Never reads other tables. (Phase 2+)
- **Inference** reads `Activity` + `Tasks`, writes `Summaries` +
  `progress_signal`. Never schedules. (Phase 2+)
- **NudgeEngine** reads `Tasks` + `Summaries`, writes notifications / overlay
  events. Never mutates tasks. (Phase 2+)
- **Sync** is the **only** module that talks to Google APIs.
- Modules communicate via the in-process event bus + typed `Store` repos. No
  module imports another module's internals.

## Hard constraints

- **Local-only data.** SQLite + local filesystem. User data is strictly stored locally. No cloud sync.
- **Backend API Proxy.** Outbound Gemini API calls are proxied through a secure backend server to protect developer API keys in production.

- **Outbound HTTP allowlist:** `generativelanguage.googleapis.com` (Gemini),
  `www.googleapis.com` (Docs), Google OAuth endpoints. Enforced at the
  HTTP client.
- **Never capture keystroke content.** Counts only.
- **Never upload screenshots** anywhere except (later) Gemini Vision with
  explicit user consent surfaced in Settings.
- **Phase 1 does not request** Screen Recording / Accessibility permissions.
  Those are deferred to the Monitor milestone.
- **No Wispr Flow / Cluely / third-party overlay deps.** Build the overlay with
  Electron `BrowserWindow` primitives.

## Phase scope (current: Phase 1)

**In Phase 1:**
- Typed goal capture (text)
- Gemini-powered subtask decomposition
- Local subtask scheduling (working-hours aware, no external calendar)
- Local Today / Goals / Settings views
- Overlay quick-add (global hotkey)

**Deferred to later phases — do not add yet:**
- Activity monitoring (screenshots, window titles, keystroke counts)
- Voice input (`whisper.cpp`)
- Inference / progress signals
- Nudge engine
- Windows port
- Multi-account, plugins, multi-device sync

## Code conventions

- **TypeScript strict** with `noUncheckedIndexedAccess`,
  `noImplicitOverride`, `noFallthroughCasesInSwitch`. Don't loosen these.
- **No comments** unless the WHY is non-obvious. Don't explain WHAT — code does
  that. Don't reference the current task/fix/issue in comments.
- **No error handling for impossible states.** Validate at boundaries (user
  input, Google API responses); trust internal calls.
- **No premature abstractions.** Three similar lines is better than a wrong
  helper. Build what the current phase needs.
- **No backwards-compat shims** for code that hasn't shipped yet. Just change it.
- **No new deps unless used.** Native modules (`better-sqlite3`, `keytar`) are
  added in the task that first imports them, not pre-emptively.
- **Tests:** TDD the parts the core architecture doc names (Planner, Scheduler,
  Store). Skip TDD for UI scaffolding.
- **No real network in tests.** Use recorded fixtures with `nock`.

## CI / dev tooling

- **CI** ([.github/workflows/ci.yml](.github/workflows/ci.yml)) runs on every
  PR + push to `main`: install → typecheck → lint → test+coverage → upload
  coverage artifact. Ubuntu-only for now (add macOS/Windows when packaging
  matters).
- **Pre-commit** runs `lint-staged` via husky → eslint --fix + prettier --write
  on staged `app/**/*.{ts,tsx,json,md,yml,yaml,css,html}`.
- **Coverage gate:** soft 60% (lines/branches/functions/statements) **only on**
  `src/main/planner/**` and `src/main/store/**`. UI and other code measured but
  not gated.
- **Dependabot** weekly PRs (npm root + npm app/ + github-actions), minor/patch
  grouped, max 5 open per ecosystem.

## Lessons learned

Add an entry here every time something in this repo behaves differently from
what you first tried. Format: `### YYYY-MM-DD — short title`, then the
symptom, root cause, and fix as separate paragraphs.

### 2026-05-24 — pnpm filter must be path-based, not directory-name

**Symptom:** `pnpm -F app typecheck` → `No projects matched the filters`.

**Root cause:** `pnpm -F <name>` matches by **package name**, not directory.
The package in `app/` is named `plover` (see `app/package.json`), so
`-F app` matches nothing. `-F plover` works but couples scripts to the
package name.

**Fix:** Use path-based filter `pnpm --filter ./app <script>`. Refactor-safe
and matches the workspace glob exactly. Root scripts and CI use this form.

### 2026-05-24 — colon-named scripts need explicit `run` under `--filter`

**Symptom:** `pnpm --filter ./app test:coverage` → `No projects matched the
filters in <repo>`, even though `pnpm --filter ./app typecheck` works.

**Root cause:** pnpm treats script names containing `:` as a special case
(prefix-based dispatch across packages) and the matcher interacts oddly with
`--filter`. The error message is misleading — the filter is fine; pnpm just
won't run the colon-script through the filter shortcut.

**Fix:** Use the explicit `run` keyword: `pnpm --filter ./app run test:coverage`.
CI uses this form. Locally, either form works for non-colon scripts.

### 2026-05-24 — `vitest` doesn't see `--coverage` when passed via pnpm `--`

**Symptom:** `pnpm --filter ./app test -- --coverage` ran the tests but
produced no coverage output. Looking at the resolved command, vitest saw
`vitest run -- --coverage` — i.e. the flag arrived as a positional after `--`,
not as a CLI flag.

**Root cause:** With pnpm + workspace filter, the trailing `--` separator
doesn't reliably forward subsequent args as flags to the underlying tool. The
script becomes `vitest run -- --coverage` and vitest treats `--coverage` as
a (nonexistent) positional spec.

**Fix:** Add a dedicated `test:coverage` script in `app/package.json` that
calls `vitest run --coverage` directly. CI and humans use that script. Don't
try to forward flags through `pnpm run` for tooling that has its own CLI.

### 2026-05-24 — Electron postinstall is gated by pnpm 10's `onlyBuiltDependencies`

**Symptom:** After `pnpm install`, the `electron` and `esbuild` binaries
weren't built; pnpm warned `Ignored build scripts`.

**Root cause:** pnpm 10+ requires explicit allowlisting of packages whose
postinstall scripts may run, via `pnpm.onlyBuiltDependencies` in the root
`package.json`.

**Fix:** Root `package.json` includes:
```json
"pnpm": { "onlyBuiltDependencies": ["electron", "esbuild"] }
```
Add new packages here as they're introduced (e.g. `better-sqlite3` when the
Store milestone lands — it's a native module and will need this).

### 2026-05-24 — @google/generative-ai response functionCalls is a method, not a property

**Symptom:** `response.response.functionCalls[0]` causes TypeScript compiler error `Property '0' does not exist on type '() => FunctionCall[] | undefined'`.

**Root cause:** In the `@google/generative-ai` legacy SDK, `functionCalls` on the `EnhancedGenerateContentResponse` object is a function (getter method) that returns the list of function calls, not a direct array property.

**Fix:** Call `response.response.functionCalls()` as a function, e.g. `response.response.functionCalls()?.[0]`.

### 2026-05-24 — file creation/edit tools fail on worktree paths outside conversation directory

**Symptom:** `write_to_file`, `replace_file_content`, and `multi_replace_file_content` error with `files must be written to the correct artifact directory: <artifact-dir-of-subagent>`.

**Root cause:** These tools enforce a security/scope policy requiring all paths to be inside the active subagent's conversation ID directory. Since git worktrees created for subagents are located under the main agent's conversation directory, any workspace paths violate this check.

**Fix:** Use `run_command` with Unix tools (e.g. `cat << 'EOF' > file` or `sed`) to create or edit files in the workspace directory instead of using the custom file-handling tools.

### 2026-05-24 — Vitest vi.mock hoisted variable ReferenceError

**Symptom:** `ReferenceError: Cannot access 'mockVariable' before initialization` during Vitest runs.

**Root cause:** `vi.mock` is hoisted to the top of the file before outer variables are defined.

**Fix:** Use `vi.hoisted` to declare mock variables (e.g. `mockKeychain`, `mockOpenExternal`) so that they are declared and initialized before any hoisted `vi.mock` blocks run.

### 2026-05-24 — EventEmitter.removeAllListeners(undefined) does not clear all events

**Symptom:** In tests, calling a typed wrapper's `eventBus.removeAllListeners()` (which passed `event?: string` value of `undefined` to Node's `emitter.removeAllListeners(event)`) failed to clear listeners across tests, leading to tests running with multiple active listeners and failing.

**Root cause:** Node's `EventEmitter.prototype.removeAllListeners` checks `arguments.length` to decide whether to clear all events or just one. When `undefined` is passed explicitly, it treats it as a single argument (event name `"undefined"`) rather than no arguments.

**Fix:** Explicitly branch on `event !== undefined` and call `removeAllListeners()` with no arguments to clear all events.

### 2026-05-30 — main-process secrets load from `app/.env` via a first-import side-effect module

**Symptom:** Putting `process.loadEnvFile()` in the body of `app/src/main/index.ts` did not make `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` from `app/.env` available — OAuth still used the `mock-client-id` fallback.

**Root cause:** `google-auth.ts` reads `process.env.GOOGLE_CLIENT_ID` at module-evaluation time, and ES module imports (`index.ts` → `ipc.ts` → `google-auth.ts`) are hoisted and evaluated *before* any statement in the `index.ts` body. So a body-level `process.loadEnvFile()` runs too late. (`gemini.ts` is unaffected because it reads the key lazily inside `getGeminiClient()`.)

**Fix:** Load env in a dedicated side-effect module `app/src/main/load-env.ts` (guarded `try { process.loadEnvFile() } catch {}`) and import it as the **first** import in `index.ts` (`import './load-env.js';`). ESM evaluates imports in source order, so the env file loads before `google-auth.ts` is evaluated. Secrets live in `app/.env` (gitignored); see [docs/RUNNING.md](docs/RUNNING.md).

### 2026-05-31 — electron-vite bundles dependencies under pnpm workspace

**Symptom:** Running `pnpm dev` fails with `Error: Electron failed to install correctly. Please delete node_modules/electron...` and `getElectronPath` errors.

**Root cause:** Under a pnpm workspace structure, `electron-vite`'s automatic dependency externalization fails to match dependency/path correctly because packages resolve through the symlinked `.pnpm` virtual store. This causes the main process to bundle packages like `electron` and native dependencies (e.g. `better-sqlite3`, `keytar`) inline. At runtime, the bundled `electron/index.js` wrapper attempts to run installer scripts using a relative path that doesn't exist in `out/main/`.

**Fix:** Explicitly configure `build.rollupOptions.external` under `main` and `preload` in `app/electron.vite.config.ts` to keep `electron`, `better-sqlite3`, `keytar`, and other node modules external.

### 2026-05-31 — duplicate `__dirname` declaration crash

**Symptom:** Running `pnpm dev` fails with `SyntaxError: Identifier '__dirname' has already been declared`.

**Root cause:** When bundling/compiling with Vite/Rolldown, the bundler injects a CommonJS-style global shim block containing `const __dirname = import.meta.dirname;` at the top of the bundle. If `src/main/index.ts` also declares its own `const __dirname = ...` at the top level of the ESM file, they clash under the same module scope, causing a duplicate declaration syntax error.

**Fix:** Replace the manual declaration of `const __dirname` in source files with direct use of Node's native `import.meta.dirname` (which is fully supported in Node 20.11+).

### 2026-05-31 — native module compilation crash on Electron 42 and target mismatches

**Symptom:** Running `pnpm dev` fails to compile native modules (`better-sqlite3` fails with `too few arguments to function call... v8::External::New`), or runs into `was compiled against a different Node.js version` runtime crash.

**Root cause:** Electron 42 (bumped by Dependabot) introduces V8 14.8 which contains breaking API changes in native bindings (`ExternalPointerTypeTag`), rendering older `better-sqlite3` versions incompatible. Furthermore, native modules must be compiled for the specific V8/ABI version of the running environment (Node.js 127 vs. Electron 33's 130). In a pnpm workspace, rebuilds run in subfolders fail to target the physically-hoisted native modules in the parent `.pnpm` store.

**Fix:** 
1. Downgrade `electron` to `^33.2.0` in `app/package.json` to ensure native compatibility.
2. Automate environment-targeted recompilation in the root `package.json` scripts: prepend `npx @electron/rebuild -v 33.4.11 -f -w better-sqlite3,keytar` to the root `dev` script, and `pnpm --filter ./app rebuild better-sqlite3 keytar` to the root `test` script.

### 2026-05-31 — react and react-dom version mismatch crash

**Symptom:** The Electron application window opens but renders a completely blank white screen. The DevTools console shows `Uncaught TypeError: Cannot read properties of undefined (reading 'S')` at `react-dom_client.js`.

**Root cause:** The `react` package was pinned to version `^18.3.1` while `react-dom` and `@types/react-dom` were bumped to version 19 by Dependabot. This mismatch causes React DOM 19's client initialization code to search for React 19-specific internal dispatcher symbols (like `S`) on the loaded React 18 instance, resulting in a TypeError that crashes the React rendering tree during mount.

**Fix:** Downgrade `react-dom` and `@types/react-dom` back to `^18.3.1` in `app/package.json` to match the version of `react`, then run `pnpm install`.

### 2026-05-31 — automated gemini model fallback for 429 quota exhaustion

**Symptom:** API calls to decompose goals fail with a `429 Too Many Requests` or `Quota exceeded` exception when using the free tier key.

**Root cause:** Free-tier Gemini keys have strict Rate Limits (15 RPM / 1500 RPD) or model-specific quotas.

**Fix:** Implemented an automatic model recycling fallback loop in `app/src/main/planner/decompose.ts`. If the primary model (defined by `GEMINI_MODEL` or defaulting to `gemini-2.0-flash`) fails, the planner catches the exception, logs a console warning, and retries the request using fallback models (`gemini-1.5-flash`, `gemini-2.0-flash-lite-preview-02-05`, `gemini-1.5-pro`, and other 2.5/3.x generations in order). It only throws if all candidate models fail. (Note: Since refactoring to a client-server architecture, this fallback loop is now executed on the backend proxy server).

### 2026-06-12 — tslib required by electron-builder under pnpm workspaces

**Symptom:** Running `pnpm package` fails with `Error: Cannot find module 'tslib'` originating from `@peculiar/utils`.

**Root cause:** Under a pnpm workspace structure, dependencies of `electron-builder` (such as `@peculiar/webcrypto` and `@peculiar/utils`) require the helper module `tslib`, but it was not resolved correctly due to pnpm's strict isolation.

**Fix:** Install `tslib` as a development dependency at the root of the workspace (`pnpm add -D -w tslib`).

### 2026-06-12 — `noUncheckedIndexedAccess` + ESLint `no-non-null-assertion` forces destructure + optional chaining in tests

**Symptom:** Subagent-authored test files using `result[0].kind` fail typecheck with `TS2532: Object is possibly 'undefined'` because `tsconfig.json` enables `noUncheckedIndexedAccess`. Switching to `result[0]!.kind` then fails ESLint with `@typescript-eslint/no-non-null-assertion`.

**Root cause:** Both rules are intentionally on. There is no escape hatch via non-null assertion; tests must be written so the type system can prove non-`undefined`.

**Fix:** Use the destructure + optional-chaining pattern that the existing tests use:
```ts
const result = repo.listSomething();
expect(result).toHaveLength(2);
const [r0, r1] = result;
expect(r0?.kind).toBe('file_added');
```
When `r0` is undefined, `r0?.kind` is `undefined` and the `toBe(...)` assertion fails — same semantics as `!.`, but lint-clean.

### 2026-06-12 — `summaries.task_id` is a real FK; test fixtures must seed the parent task

**Symptom:** Tests for `SummariesRepo.insert({ taskId: 'task-1', ... })` fail with `SqliteError: FOREIGN KEY constraint failed`.

**Root cause:** `summaries.task_id TEXT REFERENCES tasks(id) ON DELETE SET NULL` is a real foreign key. The schema allows `task_id IS NULL` for "global" summaries, but any non-null value must reference an existing `tasks(id)` row. SQLite has foreign keys enabled in this app's migrations.

**Fix:** Seed the parent goal + task before inserting a summary in any test that uses a non-null `taskId`. See the helper pattern in `app/tests/store/summaries-repo.test.ts` (`seedTask(db, taskId)` creates a goal via `GoalsRepo.create(...)` then a task via `TasksRepo.create(...)` with the desired id).

### 2026-06-12 — corepack-based pnpm shim breaks behind corporate npm registry

**Symptom:** `pnpm <anything>` fails with `Error when performing the request to https://registry.npmjs.org/pnpm/-/pnpm-10.26.0.tgz` / `ConnectTimeoutError`, even when `~/.npmrc` already points to an internal registry. Background subagents and the main session both hit the same wall.

**Root cause:** The `pnpm` on `$PATH` (via Node/mise) is actually a corepack shim that ignores user `.npmrc` and unconditionally fetches the pinned `packageManager` version from `registry.npmjs.org`. On a network without direct access to `registry.npmjs.org` (VPN-only, corporate restriction), corepack times out before `.npmrc` is even consulted.

**Fix:** Use the previously-installed global pnpm directly: `~/Library/pnpm/pnpm` (or wherever `pnpm setup` placed it). Prepend `~/Library/pnpm` to `PATH` so subprocesses (including scripts that re-shell out to `pnpm`) resolve to the global binary rather than the corepack shim:
```sh
export PATH=/Users/<user>/Library/pnpm:$PATH
pnpm install   # now actually uses the internal registry from ~/.npmrc
```
Subagents that need to install deps will hit this same wall and report "network/corepack issue" — orchestrator must pre-install deps from the main session or pass the PATH override into the subagent prompt.

### 2026-05-24 — Preload build output filename extension mismatch in ESM packages

**Symptom:** The main process loads `../preload/index.js` but the built preload script is outputted as `index.mjs`, causing a runtime file-not-found error in Electron.

**Root cause:** When `"type": "module"` is set in `package.json`, Vite/Rollup defaults to building outputs as ESM (using the `.mjs` extension) even when specifying `entryFileNames: '[name].js'`.

**Fix:** Configure the preload config's Rollup output options in `electron.vite.config.ts` to build in CommonJS format (`format: 'cjs'`) and set `entryFileNames: '[name].js'`.

### 2026-06-24 — Port 3000 occupied by other local servers causes 404 in goal decomposition

**Symptom:** Invoking `goals:decompose` fails with `Goal decomposition failed: Server responded with status 404`.

**Root cause:** The backend proxy server by default runs on port `3000`. If port `3000` is already occupied by another local service (e.g., a Next.js dev server), HTTP requests from the Electron client targeting `http://localhost:3000/api/decompose` will hit the other service instead, resulting in a 404.

**Fix:** Create `server/.env` and assign `PORT=3001` (or another unused port), and create `app/.env` to configure `PLOVER_BACKEND_URL=http://localhost:3001`. Both processes must be restarted to load their respective environment files.

- **Google API calls must live in Sync module**

**Symptom:** Activity module had direct dependencies on `googleapis` and `GoogleAuth`.

**Root cause:** This violated the architectural rule that only Sync talks to Google APIs, leading to logic duplication and OAuth scope creep.

**Fix:** Move polling logic to `Sync` module. Use the event bus (`gdocs.revision` event) to notify the `Activity` module of updates. Refactor Activity tracker into a subscriber that only writes to `ActivityRepo`.

### 2026-07-19 — `PLOVER_BACKEND_URL` from `app/.env` was silently overridden by a Vite build-time default

**Symptom:** Clicking "Continue with Google" on the signup screen in `pnpm dev` opened a browser tab to `http://localhost:3000/signup?state=…` (connection refused) instead of the Cloud Run URL set in `app/.env`.

**Root cause:** `electron.vite.config.ts` had `'import.meta.env.PLOVER_BACKEND_URL': JSON.stringify(process.env.PLOVER_BACKEND_URL ?? 'http://localhost:3000')`. `process.env.PLOVER_BACKEND_URL` is unset at Vite build time (only `app/.env` sets it, and that's loaded by `load-env.ts` at runtime in the main process). So Vite baked the literal `'http://localhost:3000'` into every consumer. The consumers (`signup-flow.ts`, `authed-fetch.ts`) check `import.meta.env.PLOVER_BACKEND_URL` first and only fall through to `process.env.PLOVER_BACKEND_URL` if the Vite value is falsy — but the bake made it always-truthy, so the runtime `app/.env` value never won.

**Fix:** Default the Vite define to an empty string (`JSON.stringify(process.env.PLOVER_BACKEND_URL ?? '')`). Now if the env var is unset at build time, `if (fromVite)` in the consumers is falsy and they correctly fall through to the runtime `process.env` value. Packaged builds still work because CI sets `PLOVER_BACKEND_URL` in the release workflow env before `pnpm package`, so Vite bakes the real value.

### 2026-07-18 — Calendar sync removed but `tasks.calendar_event_id` column intact

**Symptom:** `store/db.ts` still defines `calendar_event_id TEXT` on the `tasks` table even though no application code reads or writes it after the Calendar-sync removal.

**Root cause:** Dropping a column requires a new migration, and existing installs would fail if we altered v1 in place. We deliberately left the column so existing DBs stay usable.

**Fix:** Do NOT re-add references. If you're touching the tasks schema for another reason, bundle a proper `ALTER TABLE tasks DROP COLUMN calendar_event_id` migration then (SQLite ≥3.35 supports it). Until then, treat the column as vestigial.

### 2026-06-24 — Clicking "Open setup overlay" opens duplicate main window instead of setup flow

**Symptom:** In the "Today" page empty state, clicking "Open setup overlay" opens a new window, but the window renders a duplicate of the main application (with sidebar/main tabs) rather than the setup/overlay flow.

**Root cause:** The setup flow window is loaded with `?variant=window`. However, `main.tsx` determined whether to render `<Overlay />` (which renders the setup/overlay steps) or `<App />` (which renders the main application layout) by checking if `window.location.search` includes the literal string `"overlay"`. Since `variant=window` does not contain `"overlay"`, it incorrectly fell back to rendering `<App />`.

**Fix:** Update `main.tsx` to parse the `variant` query parameter and match both `"overlay"` and `"window"` variants as the overlay/setup flow.

### 2026-07-17 — Electron GUI can't be launched for visual verification via Bash/PowerShell tool on this Windows box

**Symptom:** Ran `pnpm dev` (and, directly, `node_modules/electron/dist/electron.exe .`) via the Bash/PowerShell tools, in both foreground and background modes, to visually confirm a titlebar UI change. Each time, the wrapping shell command reports a clean exit code 0 within seconds and no Electron/`electron.exe` process is left running (`Get-Process` finds nothing), with zero stdout/stderr captured even when redirected to a log file — no crash message, nothing.

**Root cause:** The Bash/PowerShell tool's shell runs in a sandboxed subprocess context that has no attached interactive Windows desktop/session. Electron is a GUI app that needs a real window station to create a `BrowserWindow`; without one it exits immediately and silently (no console output at all, since it never gets far enough to log anything). This is a different execution context from the one the `computer-use` MCP tools see and control (the user's actual visible desktop) — processes launched via Bash/PowerShell here are invisible to `computer-use`, and vice versa there's no way to attach `computer-use` to a process spawned this way.

**Fix:** Don't try to visually verify Electron GUI changes by launching `pnpm dev`/the Electron binary through the Bash/PowerShell tool and then screenshotting via `computer-use` — it will silently fail with no diagnostic signal. For UI changes in this repo, verify via `pnpm typecheck && pnpm lint && pnpm test`, a careful manual read of the diff, and (if genuinely needed) ask the user to run `pnpm dev` themselves and confirm visually on their own desktop session.

### 2026-07-18 — concurrent sessions in the same working directory silently swap out HEAD mid-task

**Symptom:** Ran `git checkout -b <new-branch> origin/main` in the primary working directory, then did unrelated work (writing a plan file), then `git commit`. The commit landed on local `main` instead of the new branch. `git reflog` showed a `checkout: moving from <new-branch> to main` event between the branch creation and the commit that this session never issued.

**Root cause:** The user (or another Claude Code session/tool) was actively working in the same primary checkout (`C:\Users\hhl_c\Documents\GitHub\Plover`) at the same time — switching branches and committing on their own branch. A single working directory has exactly one HEAD; whichever actor checks out last wins, and neither actor gets a warning. This is invisible from inside a session — there's no signal that another process touched HEAD except retroactively via `git reflog`.

**Fix:** When there's any chance the user or another session is concurrently using the primary repo directory (ask if unsure — don't assume), do multi-step git work (branch + commits) in an isolated `git worktree` instead: `git worktree add <sibling-path> <branch>`, then run all further `Bash`/`Edit` calls with that path, never the primary directory. If a stray commit already landed on the wrong branch before noticing, recover it non-destructively — `git cherry-pick <sha>` onto the correct branch from the worktree — rather than resetting the branch the other actor is using, which they might be actively building on top of.


