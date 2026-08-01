# CLAUDE.md — Plover project context

This file is loaded automatically into every Claude session in this repo. Read it
top-to-bottom before doing any work. Treat it as the source of truth for project
context, conventions, and known footguns.

## How to work in this repo (read this first)

1. **Spec is authoritative.** The product spec and the Phase 1 specs under
   [docs/superpowers/specs/](docs/superpowers/specs/) define scope, constraints,
   and the file layout. Do not scope-creep beyond the current phase.
2. **Footgun knowledge is a contract.** If you hit an error, surprise, or
   wrong-first-attempt that a future Claude could avoid, capture it **before
   reporting completion** — but NOT in this file. Add it to the most relevant
   `plover-*` reference skill under `.claude/skills/` (Quick-reference table +
   Details), or create a new one via the `superpowers:writing-skills` skill. Be
   concrete: command/file, symptom, root cause, fix. See "Known footguns →
   skills" at the bottom. This applies even to small mistakes.
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
├── pnpm-workspace.yaml             # packages: [app]
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

**Always use path-based filters (`--filter ./app`)**, not name-based
(`-F plover`). See the `plover-pnpm-workspace` skill.

**Always use `pnpm --filter ./app run <script>`** when the script name contains
a colon (e.g. `test:coverage`). See the `plover-pnpm-workspace` skill.

To run the app end-to-end locally (API keys, Google Docs/Drive OAuth setup, manual test
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
- **Keep coupled deps in version lockstep.** `react`/`react-dom`/`@types/react-dom`
  must share a major; a Dependabot bump to one and not the other renders a blank
  white screen. Watch Dependabot PRs that touch `react*`, `electron`, or native
  modules — see the `plover-electron-vite-build` / `plover-native-modules` skills.
- **Tests:** TDD the parts the core architecture doc names (Planner, Scheduler,
  Store). Skip TDD for UI scaffolding.
- **No real network in tests.** Use recorded fixtures with `nock`.

## CI / dev tooling

- **CI** ([.github/workflows/ci.yml](.github/workflows/ci.yml)) runs on every
  PR + push to `main`: install → typecheck → lint → test. Coverage
  instrumentation + the coverage artifact upload only run on the `pull_request`
  trigger (that's the only place the 60% gate can still block a merge); the
  `push: main` run does a plain `pnpm --filter ./app test` to avoid paying for
  coverage overhead on a run with no PR left to gate. Ubuntu-only for now (add
  macOS/Windows when packaging matters).
- **Pre-commit** runs `lint-staged` via husky → eslint --fix + prettier --write
  on staged `app/**/*.{ts,tsx,json,md,yml,yaml,css,html}`.
- **Coverage gate:** soft 60% (lines/branches/functions/statements) **only on**
  `src/main/planner/**` and `src/main/store/**`. UI and other code measured but
  not gated.
- **Dependabot** weekly PRs (npm root + npm app/ + github-actions), minor/patch
  grouped, max 5 open per ecosystem.

## Known footguns → skills

The old "Lessons learned" log lived here and grew to 30+ entries loaded into
every session. Those domain-specific footguns now live as **on-demand reference
skills** under [`.claude/skills/plover-*`](.claude/skills/). Claude Code surfaces
each by its trigger `description`, so the relevant one loads only when you hit its
symptom — grep an error string or symptom and invoke the matching skill:

| Skill | Covers |
|---|---|
| `plover-pnpm-workspace` | pnpm `--filter` form, colon-scripts, `--coverage`, `onlyBuiltDependencies`, corepack-vs-corporate-registry |
| `plover-native-modules` | better-sqlite3/keytar ABI, `@electron/rebuild`, electron version pin, tslib/electron-builder |
| `plover-electron-vite-build` | dep externalization, `__dirname`, preload `.mjs`, react/react-dom mismatch, dev/prod window URL |
| `plover-electron-windows-overlay` | overlay/setup window variant routing, transparent-window black-box, positioning |
| `plover-env-and-backend` | `load-env` ordering, `PLOVER_BACKEND_URL` vite bake, backend port |
| `plover-testing` | vitest `vi.hoisted`, FK fixtures, `noUncheckedIndexedAccess` pattern, rebuild-ABI-before-tests, GUI-verify limits, pre-existing renderer fails |
| `plover-git-safety` | subagent-worktree file tools, concurrent-checkout HEAD swaps, second checkout, PR base-branch |
| `plover-store-schema` | vestigial `calendar_event_id`, `created_at`/`updated_at` not an age signal |
| `plover-gemini` | `functionCalls()` method, 429 model fallback |

**Contract (replaces the old "add a lesson" rule):** when you hit an error,
surprise, or wrong-first-attempt a future Claude could avoid, add it to the most
relevant existing `plover-*` skill's Quick-reference table + Details (or create a
new `plover-*` skill via the `superpowers:writing-skills` skill) **before
reporting completion** — do NOT grow this file. If the footgun is actually an
always-true rule, promote it into the relevant rules section above instead.
