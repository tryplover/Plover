# Plover

A cute little work buddy that lives on your desktop.

Tell Plover what you're about to work on. It breaks the task into steps with
Gemini, runs a focus timer, reminds you to stay locked in, and checks in on how
it's going — a small, minimalist character with clean animations that keeps you
company while you work. Your data stays on your machine; only Gemini calls leave
it, proxied through the hosted backend.

> **Status: pivoting.** Plover is moving from AI progress tracking to the desktop buddy described in the [pivot spec](docs/superpowers/specs/2026-10-02-desktop-buddy-pivot-spec.md). The existing app (goal decomposition, scheduling, Today/Goals/Settings views, overlay) still builds and runs; activity monitoring, progress inference and the Google/GitHub connectors are frozen. Launch is waitlist-only on tryplover.com. The Gemini proxy lives in the standalone [plover-server](https://github.com/tryplover/plover-server) repo on Google Cloud Run — see [GCP & GitHub Setup Details](docs/plans/gcp-setup-details.md).

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
├── docs/superpowers/specs/         # pivot spec, original spec, phase architecture
├── reports/, research_notes/       # background research
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

- **[Desktop buddy pivot spec](docs/superpowers/specs/2026-10-02-desktop-buddy-pivot-spec.md)** —
  current product direction: the character, flows, v1 scope, and what's kept
  vs. frozen from the existing app
- **[Original product spec](docs/superpowers/specs/2026-05-24-task-tracker-agent-product-spec.md)** —
  superseded; kept for history
- **[Research](reports/)** — progress-visibility motivation evidence and the
  competitive landscape ([notes](research_notes/))
- **[Phase 1 core architecture](docs/superpowers/specs/phase-1/core-architecture.md)** —
  hard constraints, tech stack, file layout, module contracts, implementation
  order, cross-cutting acceptance criteria
- **[Phase 1 store layer](docs/superpowers/specs/phase-1/store-layer.md)** —
  SQLite migrations + typed repos that every feature reads/writes through
- **[CLAUDE.md](CLAUDE.md)** — conventions and footguns; useful for humans too,
  not just Claude

Read the pivot spec before opening a PR — its scope and "what carries over"
table set what to build and what not to touch. The Phase 1 architecture doc
still describes the module boundaries the code follows.

## Privacy posture

Plover is local-first by design. (Activity monitoring and the connectors are
frozen for the pivot, but these rules still apply to the code that exists.)

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
