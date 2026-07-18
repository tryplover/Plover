# AGENTS.md — context for Jules & other autonomous coding agents

> This file is the single-source briefing for automated agents (Jules, background
> Claude runs, CI helpers) working in this repo. Human contributors: see
> [CLAUDE.md](./CLAUDE.md) for the fuller version with in-session workflow rules.
> This file is intentionally trimmed to what an agent needs *before touching
> code in a sandbox*.

## TL;DR — what this repo is

**Plover** is a local-first Electron desktop productivity agent. It turns
vague goals into a calendar and shepherds the user to finish them. It is a
pnpm workspace with two packages:

- `app/` — the Electron app (`name: "plover"`, main/preload/renderer + tests)
- `server/` — a small Express proxy that fronts the Gemini API so the
  developer key isn't shipped to end users

Phase 1 (current) covers: typed goal capture, Gemini-powered subtask
decomposition, local subtask scheduling into working-hours windows, local
Today/Goals/Settings views, and an overlay quick-add hotkey. (Google Calendar
sync was removed 2026-07-18; the Sync module now only polls Google Docs.)

Deferred (do **not** add): activity monitoring, voice input, inference /
progress signals, nudge engine, Windows port, multi-account/plugins/sync.

Authoritative specs:
- Product spec: [docs/superpowers/specs/2026-05-24-task-tracker-agent-product-spec.md](docs/superpowers/specs/2026-05-24-task-tracker-agent-product-spec.md)
- Phase 1 architecture: [docs/superpowers/specs/phase-1/core-architecture.md](docs/superpowers/specs/phase-1/core-architecture.md)

## Environment expectations (Jules-specific)

- **Node 22** (see `.nvmrc`). `package.json#engines` accepts >= 20 but CI runs
  22 — match that.
- **pnpm 10.26.0**, pinned via `packageManager` in the root `package.json`.
  Use corepack (`corepack enable && corepack prepare pnpm@10.26.0 --activate`)
  — do **not** install pnpm from `npm i -g` or you'll drift.
- **Setup script:** `./setup.sh` at the repo root does the whole install +
  native-module rebuild. Point Jules' setup field at it.
- **What Jules can run:** `pnpm typecheck`, `pnpm lint`, `pnpm test`,
  `pnpm --filter ./app run test:coverage`, `pnpm build`,
  `pnpm --filter ./server build`.
- **What Jules cannot run:** `pnpm dev` and `pnpm package`. Both require a GUI
  and either Electron-launchable env or code-signing tooling. Don't try.
- **No secrets available.** `GEMINI_API_KEY`, `GOOGLE_CLIENT_ID`,
  `GOOGLE_CLIENT_SECRET` are all absent in the sandbox. Any code path that
  hits the real network in a test is a bug — see the "no real network"
  convention below.

## Commands cheat-sheet

Run everything from the repo root.

| Command | Purpose |
|---|---|
| `pnpm install` | Install workspace deps + husky prepare |
| `pnpm typecheck` | `tsc --noEmit` on `app/` |
| `pnpm lint` | ESLint on `app/` |
| `pnpm test` | Vitest run (auto-rebuilds native modules first) |
| `pnpm --filter ./app run test:coverage` | Vitest + v8 coverage |
| `pnpm --filter ./app exec <tool>` | Run a tool binary inside `app/` |
| `pnpm --filter ./server build` | Compile the backend proxy server |

Two footguns baked into these commands (learned the hard way — see Lessons):

1. **Always use path-based filters** (`--filter ./app`), never name-based
   (`-F plover` / `-F app`). Name filters break refactors and directory
   filters break because the package name isn't `app`.
2. **Colon scripts need explicit `run`.** Use
   `pnpm --filter ./app run test:coverage`, not `pnpm --filter ./app test:coverage`.

## Architecture rules (load-bearing — do not violate)

The core-architecture doc calls these "load-bearing" module boundaries.
Crossing them defeats the whole design.

- **Store** (`app/src/main/store/`) exposes typed repos: `Goals`, `Tasks`,
  `Sessions`, `Activity`, `Summaries`. **No module reaches into raw SQLite.**
- **Planner** is a pure function: `(goal_text, context) → {goal, subtasks[]}`.
  Side effects only via `Store` and `Sync`.
- **Monitor** (Phase 2+) writes to `Activity` only. Never reads other tables.
- **Inference** (Phase 2+) reads `Activity` + `Tasks`, writes `Summaries` +
  `progress_signal`. Never schedules.
- **NudgeEngine** (Phase 2+) reads `Tasks` + `Summaries`, writes notifications
  / overlay events. Never mutates tasks.
- **Sync** is the **only** module that talks to Google APIs.
- Modules communicate via the in-process event bus + typed `Store` repos.
  Never import another module's internals.

## Hard constraints (privacy / security)

- **Local-only user data.** SQLite + local filesystem. No cloud sync.
- **Backend proxy for Gemini.** Outbound Gemini calls go through
  `server/` so the API key isn't shipped in the Electron bundle. Do not
  inline API keys into `app/`.
- **HTTP allowlist:** `generativelanguage.googleapis.com`,
  `www.googleapis.com`, Google OAuth endpoints. Enforced at the HTTP client.
- **Never capture keystroke content.** Counts only.
- **Never upload screenshots** anywhere (Vision integration is future work
  and gated on explicit user consent).
- **Phase 1 does not request Screen Recording / Accessibility.** Don't add
  those entitlements.
- **No Wispr Flow / Cluely / third-party overlay deps.** Build the overlay
  with Electron `BrowserWindow` primitives.

## Code conventions

- **TypeScript strict** with `noUncheckedIndexedAccess`, `noImplicitOverride`,
  `noFallthroughCasesInSwitch`. Do **not** loosen these to make an edit
  compile — restructure the code instead.
- **No comments** unless the *why* is non-obvious. Don't explain *what* — the
  code does that. Don't reference the current task/PR/issue in a comment.
- **No error handling for impossible states.** Validate at boundaries (user
  input, Google API responses); trust internal calls.
- **No premature abstractions.** Three similar lines beat a wrong helper.
- **No backwards-compat shims** for code that hasn't shipped yet — just
  change it.
- **New deps only when actually imported.** Especially native modules
  (`better-sqlite3`, `keytar`, `get-windows`) — those need to be added to
  `pnpm.onlyBuiltDependencies` in the root `package.json` (see Lesson #4).
- **Tests:** TDD is required for Planner, Scheduler, and Store. UI scaffolding
  can skip TDD.
- **No real network in tests.** Use `nock` with recorded fixtures.

## Testing patterns Jules will encounter

Two idioms show up all over `app/tests/` and are worth internalizing before
authoring new tests:

**Destructure + optional-chain, not `!`.** `noUncheckedIndexedAccess` makes
`arr[0]` possibly-`undefined`, and ESLint's `no-non-null-assertion` blocks
`arr[0]!`. Do this instead:

```ts
const result = repo.listSomething();
expect(result).toHaveLength(2);
const [r0, r1] = result;
expect(r0?.kind).toBe('file_added');
```

**Seed FKs before inserting.** `summaries.task_id` is a real FK to `tasks(id)`.
Any test that inserts a summary with a non-null `taskId` must first create a
goal and task. See `app/tests/store/summaries-repo.test.ts` `seedTask` helper.

**`vi.hoisted` for mock vars.** `vi.mock` is hoisted; anything it captures
from the enclosing file must be declared via `vi.hoisted(() => ({...}))` or
you'll get `ReferenceError: Cannot access 'x' before initialization`.

**`removeAllListeners()` with no args.** Passing `removeAllListeners(undefined)`
clears nothing — Node checks `arguments.length`. Branch on `event !== undefined`.

## Lessons learned that matter *for automated runs*

The full log lives at the bottom of [CLAUDE.md](./CLAUDE.md). These are the
subset a background agent is most likely to trip on:

- **pnpm filter must be path-based** (`--filter ./app`), not name-based.
- **Colon-named scripts** require the explicit `run` keyword under `--filter`.
- **Native modules must be rebuilt** for the running V8/Electron ABI —
  `setup.sh` does this. Electron is pinned to `^42.5.1` in `app/package.json`;
  keep that in sync with the version in root `dev` and setup rebuild flags.
- **`pnpm.onlyBuiltDependencies`** gates postinstall for `electron`, `esbuild`,
  `better-sqlite3`, `keytar`, `get-windows`. Adding a new native dep? Add it
  here too or its postinstall will silently skip.
- **`process.loadEnvFile()` in the body of `index.ts` is too late** — ESM
  imports evaluate first. Use `app/src/main/load-env.ts` as the first import.
- **Preload output must be `.js`, not `.mjs`.** `electron.vite.config.ts`
  configures preload as `format: 'cjs'` with `entryFileNames: '[name].js'`.
- **Don't declare `const __dirname`** — the ESM bundler injects one; use
  `import.meta.dirname` directly (Node 20.11+).
- **Corepack behind a corporate registry can hang.** If `pnpm install` blocks
  on `registry.npmjs.org`, the fix is to prepend a globally-installed pnpm to
  `PATH`. Not typically a problem in Jules — flagged for completeness.
- **Port 3000 collisions** break the Gemini proxy. `server/.env` uses
  `PORT=3001` and `app/.env` uses `PLOVER_BACKEND_URL=http://localhost:3001`.
  Neither `.env` is checked in; agents that need them must synthesize test
  values or mock the client.
- **Gemini quota rotates keys, not models.** The retry stack in
  `server/src/gemini-client.ts` rotates through `GEMINI_API_KEYS` (comma
  list) before falling through model candidates. Don't reinvent this.

## Verification before claiming done

Before saying a change is complete, run — and confirm green output for — all
three:

```bash
pnpm typecheck && pnpm lint && pnpm test
```

If a test needs a native module you just touched, run
`pnpm --filter ./app rebuild better-sqlite3 keytar` first. If a lesson from
above bit you, add a dated entry to the "Lessons learned" section of
`CLAUDE.md` before opening the PR.

## When in doubt

1. Re-read the Phase 1 core architecture at
   `docs/superpowers/specs/phase-1/core-architecture.md`.
2. Grep the tests — they encode the invariants the code must preserve.
3. If a design decision isn't in the specs and isn't obvious from the code,
   leave a `TODO(scope):` in the PR body (not the code) and ask.
