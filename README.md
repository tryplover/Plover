# Plover

A local-first desktop agent that turns vague goals into a schedule and
shepherds you toward finishing them. Built for the 3-month Gemini hackathon.

You tell Plover what you want to get done — by voice or text. It decomposes
the goal with Gemini, schedules tasks locally within your working-hours windows,
watches your screen and files in the background, and tells you when you're on or
off track. Nothing leaves your machine except Gemini calls (proxied through the
hosted backend) and calls to the Google/GitHub APIs you connect (Drive/Docs,
Gmail, Calendar, Classroom, GitHub).

> **Status:** Goal capture, Gemini decomposition, local working-hours scheduling, the Today/Goals/Settings views, and the overlay quick-add have shipped; activity monitoring, inference, and Google/GitHub context sources are landing incrementally. The Gemini backend proxy lives in the standalone repository [plover-server](https://github.com/tryplover/plover-server), hosted on Google Cloud Run.
> See [docs/superpowers/specs/](docs/superpowers/specs/) for the product specs, and the [GCP & GitHub Setup Details](docs/plans/gcp-setup-details.md) for details on the hosted infrastructure.

## Quickstart

**Prerequisites**

- Node 22 (or whatever's in [`.nvmrc`](.nvmrc) — `nvm use` picks it up)
- pnpm 10+ (`npm i -g pnpm` if you don't have it)
- macOS (Phase 1 is mac-first; Windows port comes later)

**Install and run**

```bash
pnpm install        # one-time setup + git hooks
pnpm dev            # launches the Electron app in dev mode
```

The app launches into onboarding and then the Today / Goals / Settings views. To
exercise goal decomposition and the Google/GitHub connectors you'll need
Gemini/Google credentials — see [docs/RUNNING.md](docs/RUNNING.md).

## Common commands

All commands run from the repo root.

| Command | What it does |
|---|---|
| `pnpm dev` | Launch Electron in dev mode (HMR for renderer) |
| `pnpm build` | Production build via electron-vite |
| `pnpm typecheck` | `tsc --noEmit` on the app |
| `pnpm lint` | ESLint |
| `pnpm test` | Vitest (no coverage) |
| `pnpm --filter ./app run test:coverage` | Vitest + v8 coverage report |
| `pnpm --filter ./app format` | Prettier write across the app |

CI runs typecheck → lint → test+coverage on every PR. Husky runs
eslint+prettier on staged files at commit time.

## Project structure

```
.
├── CLAUDE.md                       # context for Claude sessions
├── README.md                       # ← you are here
├── docs/superpowers/specs/         # product spec + Phase 1 architecture
├── .github/                        # CI workflow, Dependabot, PR template
└── app/                            # the Electron app
    ├── src/
    │   ├── main/                   # Electron main process
    │   ├── preload/
    │   ├── renderer/               # React UI
    │   └── shared/                 # cross-process types
    └── tests/
```

The `app/` directory is a pnpm workspace package named `plover`.

## Documentation

- **[Product spec (PRD)](docs/superpowers/specs/2026-05-24-task-tracker-agent-product-spec.md)** —
  vision, user flows, feature scope, architecture, milestones
- **[Phase 1 core architecture](docs/superpowers/specs/phase-1/core-architecture.md)** —
  hard constraints, tech stack, file layout, module contracts, implementation
  order, cross-cutting acceptance criteria
- **[Phase 1 store layer](docs/superpowers/specs/phase-1/store-layer.md)** —
  SQLite migrations + typed repos that every feature reads/writes through
- **[CLAUDE.md](CLAUDE.md)** — conventions and footguns; useful for humans too,
  not just Claude

Read the core architecture doc before opening a PR — its "Implementation order"
and "What NOT to do" sections set the scope rules for the current phase.

## Privacy posture

Plover is local-first by design:

- All persistent user data lives on disk (SQLite + local files); no user data is
  synced to a cloud backend. Gemini calls are proxied through the hosted
  `plover-server`, which holds only the developer API key — never user data.
- Outbound HTTP is scoped to an allowlist: `generativelanguage.googleapis.com`,
  `www.googleapis.com`, `gmail.googleapis.com`, `calendar.googleapis.com`,
  `classroom.googleapis.com`, `api.github.com`, and Google OAuth endpoints
  (`oauth2.googleapis.com`, `accounts.google.com`). The `assertAllowedHost` helper
  in `app/src/main/http/allowlist.ts` documents this set.
- Keystroke **counts only** — never key content.
- Screenshots are never uploaded anywhere except (later, Phase 2+) Gemini
  Vision with explicit user consent surfaced in Settings.
- A visible "monitor active" indicator is always present on the overlay; pause
  is a hard kill-switch.

## Tech stack

Electron · TypeScript (strict) · React · Vite (electron-vite) · better-sqlite3 ·
`googleapis` SDK (Drive/Docs/Gmail/Calendar/Classroom) · `keytar` (OAuth token
storage) · Vitest · ESLint · Prettier · pnpm workspace · GitHub Actions. Gemini
access runs through the standalone `plover-server` proxy, not bundled in `app/`.

(Native modules like `better-sqlite3` and `keytar` are added when the
milestone that uses them lands, not pre-emptively.)

## Contributing

This is a hackathon project; PRs follow the template in
[`.github/PULL_REQUEST_TEMPLATE.md`](.github/PULL_REQUEST_TEMPLATE.md):
typecheck/lint/tests green, no scope creep into deferred phases, no new
outbound destinations outside the allowlist.
