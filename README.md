# Plover

A cute little work buddy that lives on your desktop.

Plover is a small, minimalist character with clean animations that sits in an
always-on-top window and keeps you company while you work. The MVP is
deliberately simple and doesn't lean on AI:

- **Task breakdown**: type a big task and split it into small steps. Plover
  suggests steps (Gemini), and you can always write or edit them yourself.
- **Pomodoro timer**: work/break cycles, with the buddy working alongside you.
- **Site and tab blocking**: keep a blocklist; distracting sites stay blocked
  until your focus block ends (via a companion browser extension).
- **Focus mode**: one "lock in" switch that starts the timer, turns on
  blocking and quiets everything but gentle nudges.
- **Calendar integration**: read-only Google Calendar, so a focus block
  doesn't run into your next meeting.

Gamification and more come later. Your data stays on your machine; only
Gemini calls leave it, proxied through the hosted backend.

> **Status: pivoting.** Plover is moving from AI progress tracking to the desktop buddy described in the [pivot spec](docs/superpowers/specs/2026-10-02-desktop-buddy-pivot-spec.md); the build order is in the [MVP roadmap](docs/plans/mvp-five-features-roadmap.md). The existing app (goal decomposition, Today/Goals/Settings views, companion window) still builds and runs; activity monitoring, progress inference, the scheduler and every connector except Google Calendar are frozen. Launch is waitlist-only on tryplover.com. The Gemini proxy lives in the standalone [plover-server](https://github.com/tryplover/plover-server) repo on Google Cloud Run (see [GCP & GitHub Setup Details](docs/plans/gcp-setup-details.md)).

## Quickstart

**Prerequisites**

- Node 22 (or whatever's in [`.nvmrc`](.nvmrc) — `nvm use` picks it up)
- pnpm 10+ (`npm i -g pnpm` if you don't have it)
- macOS or Windows (launch OS is still an open question in the spec)

**Install and run**

```bash
pnpm install        # one-time setup + git hooks
pnpm dev            # launches the Electron app in dev mode
```

The app currently launches into onboarding and the pre-pivot Today / Goals /
Settings views while the buddy is being built. To exercise step suggestions and
Google Calendar you'll need Gemini/Google credentials (see
[docs/RUNNING.md](docs/RUNNING.md)).

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
  current product direction: the character, the five MVP features, and what's
  kept vs. frozen from the existing app
- **[MVP roadmap](docs/plans/mvp-five-features-roadmap.md)**: milestone
  order and PR breakdown for the five features
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

Plover is local-first by design.

- All persistent user data lives on disk (SQLite + local files); no user data is
  synced to a cloud backend. Gemini calls are proxied through the hosted
  `plover-server`, which holds only the developer API key, never user data.
- Google Calendar access is **read-only** and optional. Events are used to warn
  you about upcoming meetings and are cached locally only.
- The blocking extension only enforces the blocklist the app gives it, over a
  loopback-only connection. It never sends your browsing history anywhere,
  including back to the app.
- Outbound HTTP is scoped to an allowlist: `generativelanguage.googleapis.com`,
  `www.googleapis.com`, `gmail.googleapis.com`, `calendar.googleapis.com`,
  `classroom.googleapis.com`, `api.github.com`, and Google OAuth endpoints
  (`oauth2.googleapis.com`, `accounts.google.com`). The `assertAllowedHost` helper
  in `app/src/main/http/allowlist.ts` documents this set.
- No screen capture, window-title logging or keystroke capture in the MVP.
  (Frozen activity-monitoring code still follows the old rules: keystroke
  counts only, never content.)

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
typecheck/lint/tests green, no scope creep beyond the five MVP features, no new
outbound destinations outside the allowlist.
