# Plover

A cute little work buddy that lives in your browser.

Plover is a Chromium browser extension: a small, minimalist character with
clean animations that floats in the corner of the pages you work in and keeps
you company. The MVP is deliberately simple and doesn't lean on AI:

- **Task breakdown**: type a big task and split it into small steps. Plover
  suggests steps (Gemini), and you can always write or edit them yourself.
- **Pomodoro timer**: work/break cycles, with the buddy working alongside you.
- **Site and tab blocking**: keep a blocklist; distracting sites stay blocked
  until your focus block ends.
- **Focus mode**: one "lock in" switch that starts the timer, turns on
  blocking and quiets everything but gentle nudges.
- **Calendar integration**: read-only Google Calendar, so a focus block
  doesn't run into your next meeting.

Gamification and more come later. Your tasks stay in your browser; only your
settings sync (through your browser's own sync), and only step-suggestion
requests leave it, proxied through the hosted backend.

> **Status.** Plover is a Chrome (Chromium) extension. The earlier Electron desktop app was deleted on 2026-10-26; see the [product spec](docs/superpowers/specs/2026-10-02-desktop-buddy-pivot-spec.md). Launch is waitlist-only on tryplover.com, through an unlisted Chrome Web Store listing. The Gemini proxy lives in the standalone [plover-server](https://github.com/tryplover/plover-server) repo on Google Cloud Run (see [GCP & GitHub Setup Details](docs/plans/gcp-setup-details.md)).

## Quickstart

**Prerequisites**

- Node 22 (or whatever's in [`.nvmrc`](.nvmrc) — `nvm use` picks it up)
- pnpm 10+ (`npm i -g pnpm` if you don't have it)
- A Chromium browser (Chrome, Edge, Brave, Arc)

**Install and run**

```bash
pnpm install        # one-time setup + git hooks
pnpm dev            # WXT dev mode; load extension/.output/chrome-mv3-dev unpacked
```

Step suggestions, sign-in and Google Calendar need Supabase, backend and Google
OAuth config; see [docs/RUNNING.md](docs/RUNNING.md).

## Common commands

All commands run from the repo root.

| Command              | What it does                                      |
| -------------------- | ------------------------------------------------- |
| `pnpm dev`           | WXT dev mode for the extension                    |
| `pnpm build`         | Production build (`extension/.output/chrome-mv3`) |
| `pnpm typecheck`     | `tsc --noEmit` on the extension                   |
| `pnpm lint`          | ESLint                                            |
| `pnpm test`          | Vitest (no coverage)                              |
| `pnpm test:coverage` | Vitest + v8 coverage report                       |

CI runs typecheck → lint → test+coverage on every PR. Husky runs
eslint+prettier on staged files at commit time.

## Project structure

```
.
├── CLAUDE.md                       # context for Claude sessions
├── README.md                       # ← you are here
├── docs/superpowers/specs/         # product spec and history
├── reports/, research_notes/       # background research
├── .github/                        # CI workflow, Dependabot, PR template
└── extension/                      # the Chromium MV3 extension (WXT + React)
```

## Documentation

- **[Product spec](docs/superpowers/specs/2026-10-02-desktop-buddy-pivot-spec.md)** —
  current direction: the browser buddy, its MVP features, the extension
  architecture, and what was carried over from the deleted Electron app
- **[Original product spec](docs/superpowers/specs/2026-05-24-task-tracker-agent-product-spec.md)** —
  superseded; kept for history
- **[Research](reports/)** — progress-visibility motivation evidence and the
  competitive landscape ([notes](research_notes/))
- **[CLAUDE.md](CLAUDE.md)** — conventions and footguns; useful for humans too,
  not just Claude

Read the product spec before opening a PR; its scope sets what to build and what not to touch.

## Privacy posture

Plover is local-first by design.

- Tasks, steps and session history live in the browser on your device
  (`chrome.storage.local`). Settings (blocklist, timer lengths, buddy
  position) sync through your browser's own sync (`chrome.storage.sync`).
  Nothing is synced to a Plover server.
- Sign-in uses a Plover account (Supabase), which holds only the account.
  Step suggestions go through the hosted `plover-server`, which sees only the
  task text you ask it to break down and holds the developer Gemini key.
- Google Calendar access is **read-only** and optional. Events are used to warn
  you about upcoming meetings and are cached locally only.
- The floating buddy draws itself on pages but never reads page content. The
  extension never records your browsing history; blocking only enforces your
  blocklist.
- No screen capture, window-title logging or keystroke capture.

## Tech stack

**Extension:** Chromium Manifest V3 · TypeScript (strict) · React ·
`chrome.storage` · `declarativeNetRequest` · `chrome.alarms` ·
`chrome.identity` · Supabase auth · Gemini via the standalone `plover-server`
proxy.

Vitest · ESLint · Prettier · pnpm workspace · GitHub Actions.

## Contributing

This is a hackathon project; PRs follow the template in
[`.github/PULL_REQUEST_TEMPLATE.md`](.github/PULL_REQUEST_TEMPLATE.md):
typecheck/lint/tests green, no scope creep beyond the MVP in the product spec,
no new outbound destinations outside the allowlist.
