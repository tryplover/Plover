# CLAUDE.md — Tendril project context

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
3. **Verify before claiming.** Run `pnpm typecheck && pnpm lint && pnpm test`
   from the repo root and confirm green output before saying anything is done.
4. **Use the docs to avoid re-reading code.** This file + the two spec docs
   should be enough to start a session. Open code only when you need a specific
   detail.

## Project

**Tendril** is a local-first Electron desktop agent for the 3-month Gemini
hackathon. It turns vague goals into a calendar and shepherds the user toward
finishing them. Privacy-by-design: no cloud backend, allowlisted outbound HTTP
to Google APIs only.

- **Product spec:** [docs/superpowers/specs/2026-05-24-task-tracker-agent-product-spec.md](docs/superpowers/specs/2026-05-24-task-tracker-agent-product-spec.md)
- **Phase 1 core architecture:** [docs/superpowers/specs/phase-1/core-architecture.md](docs/superpowers/specs/phase-1/core-architecture.md)
- **Phase 1 feature specs:** [docs/superpowers/specs/phase-1/features/](docs/superpowers/specs/phase-1/features/)

The core architecture doc's "Implementation order" section (steps 1–7) is the
implementation order. Do not jump ahead.

## Workspace layout

```
.
├── CLAUDE.md                       # ← you are here
├── package.json                    # pnpm workspace root, husky/lint-staged
├── pnpm-workspace.yaml             # packages: [app]
├── .nvmrc                          # Node 22 (LTS)
├── .husky/pre-commit               # runs lint-staged
├── .github/
│   ├── workflows/ci.yml            # typecheck + lint + test+coverage
│   ├── dependabot.yml              # weekly npm + actions updates
│   └── PULL_REQUEST_TEMPLATE.md
├── docs/superpowers/specs/         # PRD + Phase 1 specs (authoritative)
│   ├── 2026-05-24-task-tracker-agent-product-spec.md
│   └── phase-1/
│       ├── core-architecture.md
│       ├── store-layer.md
│       └── features/{typed-goal-capture,subtask-decomposition,scheduling,calendar-sync,todo-views,overlay-quick-add}.md
└── app/                            # the Electron app (single workspace pkg)
    ├── package.json                # name: "tendril"
    ├── electron.vite.config.ts
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
| `pnpm typecheck` | `tsc --noEmit` on the app |
| `pnpm lint` | ESLint on the app |
| `pnpm test` | Vitest run (no coverage) |
| `pnpm --filter ./app run test:coverage` | Vitest run + v8 coverage report |
| `pnpm --filter ./app exec <tool>` | Run a tool binary inside the app workspace |

**Always use path-based filters (`--filter ./app`)**, not name-based
(`-F tendril`). See lessons-learned #1.

**Always use `pnpm --filter ./app run <script>`** when the script name contains
a colon (e.g. `test:coverage`). See lessons-learned #2.

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

- **Local-only data.** SQLite + local filesystem. No backend server.
- **Outbound HTTP allowlist:** `generativelanguage.googleapis.com` (Gemini),
  `www.googleapis.com` (Calendar/Docs), Google OAuth endpoints. Enforced at the
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
- Google Calendar OAuth + auto-scheduling
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
The package in `app/` is named `tendril` (see `app/package.json`), so
`-F app` matches nothing. `-F tendril` works but couples scripts to the
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

### 2026-05-24 — broken lockfile after merging main into a feature branch

**Symptom:** CI fails on the install step with
`ERR_PNPM_LOCKFILE_MISSING_DEPENDENCY  Broken lockfile: no entry for
'better-sqlite3@12.10.0' in pnpm-lock.yaml`. `pnpm install --frozen-lockfile`
reproduces locally. The package is present in `app/package.json` and in the
lockfile's `importers:` block, but missing from the `snapshots:`/`packages:`
sections.

**Root cause:** A merge resolved `pnpm-lock.yaml` by keeping the importer-side
edits (so the dependency is declared) but dropping the resolution snapshot
(so pnpm can't find the resolved tarball). Classic git merge of a generated
file. CI uses `--frozen-lockfile`, which (correctly) refuses to recompute.

**Fix:** Locally run `pnpm install` (no `--frozen-lockfile`). pnpm detects
the gap, fetches the missing resolution, and writes the snapshot back. Commit
the regenerated `pnpm-lock.yaml`. Never resolve lockfile merge conflicts by
hand — always re-run `pnpm install` and let pnpm own the file.
