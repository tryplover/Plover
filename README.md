# Tendril

A local-first desktop agent that turns vague goals into a calendar and
shepherds you toward finishing them. Built for the 3-month Gemini hackathon.

You tell Tendril what you want to get done — by voice or text. It decomposes
the goal with Gemini, books time on your Google Calendar, watches your screen
in the background, and tells you when you're on or off track. Nothing leaves
your machine except calls to Gemini and Google APIs.

> **Status:** Phase 1 — scaffold + tooling complete. Feature work
> (goal capture → planner → calendar sync → overlay) is the next milestone.
> See [docs/superpowers/specs/](docs/superpowers/specs/) for the full plan.

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

You'll see a window with a "Tendril" placeholder — the scaffold renders, the
toolchain works, and you can start building features against it.

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
├── docs/superpowers/specs/         # product spec + Phase 1 architecture + feature specs
├── .github/                        # CI workflow, Dependabot, PR template
└── app/                            # the Electron app
    ├── src/
    │   ├── main/                   # Electron main process
    │   ├── preload/
    │   ├── renderer/               # React UI
    │   └── shared/                 # cross-process types
    └── tests/
```

The `app/` directory is a pnpm workspace package named `tendril`. Single
package today — splitting only if it ever earns its weight.

## Documentation

- **[Product spec (PRD)](docs/superpowers/specs/2026-05-24-task-tracker-agent-product-spec.md)** —
  vision, user flows, feature scope, architecture, milestones
- **[Phase 1 core architecture](docs/superpowers/specs/phase-1/core-architecture.md)** —
  hard constraints, tech stack, file layout, module contracts, implementation
  order, cross-cutting acceptance criteria
- **[Phase 1 feature specs](docs/superpowers/specs/phase-1/features/)** — one
  doc per feature (goal capture, decomposition, scheduling, calendar sync,
  todo views, overlay quick-add)
- **[CLAUDE.md](CLAUDE.md)** — conventions and footguns; useful for humans too,
  not just Claude

Read the core architecture doc before opening a PR — its "Implementation order"
and "What NOT to do" sections set the scope rules for the current phase.

## Privacy posture

Tendril is local-first by design:

- All persistent data lives on disk (SQLite + local files). No cloud backend.
- Outbound HTTP is allowlisted to `generativelanguage.googleapis.com`,
  `www.googleapis.com`, and Google OAuth endpoints. The HTTP client enforces
  the allowlist at runtime.
- Keystroke **counts only** — never key content.
- Screenshots are never uploaded anywhere except (later, Phase 2+) Gemini
  Vision with explicit user consent surfaced in Settings.
- A visible "monitor active" indicator is always present on the overlay; pause
  is a hard kill-switch.

## Tech stack

Electron · TypeScript (strict) · React · Vite (electron-vite) · better-sqlite3 ·
`googleapis` SDK (Calendar) · `@google/generative-ai` (Gemini) · `keytar` (OAuth
token storage) · Vitest · ESLint · Prettier · pnpm workspaces · GitHub Actions.

(Native modules like `better-sqlite3` and `keytar` are added when the
milestone that uses them lands, not pre-emptively.)

## Contributing

This is a hackathon project; PRs follow the template in
[`.github/PULL_REQUEST_TEMPLATE.md`](.github/PULL_REQUEST_TEMPLATE.md):
typecheck/lint/tests green, no scope creep into deferred phases, no new
outbound destinations outside the allowlist.
