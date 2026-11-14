# CLAUDE.md — Plover project context

This file is loaded automatically into every Claude session in this repo. Read it
top-to-bottom before doing any work. Treat it as the source of truth for project
context, conventions, and known footguns.

## How to work in this repo (read this first)

1. **The design doc is authoritative.** [docs/DESIGN.md](docs/DESIGN.md) is
   the one design doc: product scope, system architecture and its rules,
   how each feature works, and planned work. Do not scope-creep beyond it.
   There are no per-feature spec files; don't create them.
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
5. **Use the docs to avoid re-reading code.** This file + `docs/DESIGN.md`
   should be enough to start a session. Open code only when you need a specific
   detail.

## Plan-then-delegate workflow

For any non-trivial changes, follow this structured cycle:

- **Write the plan** → Create a plan under `docs/plans/<name>.md` covering context, file-by-file changes, reuse of existing utilities, and verification steps. Use the `writing-plans` skill.
- **Delegate implementation** → Dispatch Haiku subagent(s) (or Sonnet/Opus for tricky tasks) to implement the plan, using one agent per independent task. Use the `subagent-driven-development` / `executing-plans` flow.
- **Review + verify** → The orchestrator reviews the subagent diffs and runs `pnpm typecheck && pnpm lint && pnpm test` before claiming completion.

Note: `docs/plans/` contains _generated implementation plans_ used as input to subagents. They are short-lived: delete a plan in the PR that finishes its work, and move anything worth keeping into `docs/DESIGN.md`.

## Design-doc workflow (every feature)

1. **Before:** read `docs/DESIGN.md` §1 (scope), §2 (architecture and rules) and
   the section for the feature. If the feature isn't there, add it (a "Planned"
   entry in §9 is enough to start) and build against it.
2. **During:** if the change adds or changes state, a message/command, a
   permission, an outbound host, a surface, what the content script receives,
   or behaviour a user would notice, update the matching `docs/DESIGN.md`
   section **in the same PR**. When a planned feature ships, move it from §9
   into §4.
3. **Capture taste/UI feedback as a durable rule.** When the user gives
   feedback about look, feel, intuitiveness or UX — affordances, visual
   separation, gestures/navigation, colour meaning, consistency, "I can't tell
   what's a button" — treat it as a standard, not a one-off fix. Fold the
   principle into `docs/DESIGN.md` §5.2 (Interaction and clarity principles) in
   the same PR as the UI change, generalising it so it applies beyond the one
   screen the user pointed at. If §5.2 already covers it, sharpen that bullet
   instead of duplicating. This applies in every session, including fresh cloud
   sessions, before reporting the UI change done.
4. **Review the diff against the doc** before claiming done, and have review
   subagents do the same: architecture rules (§2.3), permissions/network/privacy
   (§6), scope (§1.5), and whether the doc still describes the code. Report
   anything the doc and the diff disagree on.
5. **CI enforces it:** the `Design doc` check fails a PR that touches a
   load-bearing path (manifest, worker, background/content entrypoints,
   shared types/messages/storage, `features/*/worker.ts`) without touching
   `docs/DESIGN.md`. For a refactor or bug fix that doesn't change the design,
   add the `no-design-change` label and say why in the PR.

## Prefer stacked PRs

Whenever you make a change, **always consider splitting it into a stack of PRs**
rather than one large PR. If a change spans multiple independent or sequential
concerns (e.g. schema → repo → planner → UI), decompose it into a stack where
each PR is small, individually reviewable, and builds on its parent. Land the
base of the stack first and let reviewers move up.

- Default to a stack for any change that touches more than one load-bearing
  module boundary (see "Architecture rules") or that mixes refactor + feature.
- Keep each PR green on its own: `pnpm typecheck && pnpm lint && pnpm test` must
  pass at every level of the stack.
- Only skip stacking when the change is genuinely atomic (a single small,
  self-contained edit that cannot be meaningfully split).
- For stack mechanics and the GitHub-native async-merge requirement, use the
  `restack` skill and see the `plover-git-safety` skill.

## Project

**Plover** is a cute work buddy that ships as a
**Chromium browser extension** (Manifest V3; the Electron desktop app was deleted 2026-10-26): a
minimalist character with clean animations that floats on every web page, plus
a toolbar popup. The MVP is five simple features: task breakdown, Pomodoro,
site/tab blocking, focus mode and read-only Google Calendar. Sign-in (Supabase)
is required; tasks stay in `chrome.storage.local`, settings sync via
`chrome.storage.sync`, and Gemini calls are proxied through `plover-server` to
protect the developer API key. Launch is an unlisted Chrome Web Store listing
with open sign-up (no waitlist gate). The product lives in the `extension/` workspace package; the
Gemini backend `plover-server` is a separate repo.

- **Design doc (source of truth):** [docs/DESIGN.md](docs/DESIGN.md)
- **Original product spec (superseded):** [docs/archive/specs/2026-05-24-task-tracker-agent-product-spec.md](docs/archive/specs/2026-05-24-task-tracker-agent-product-spec.md)
- **Background research:** [reports/](reports/) and [research_notes/](research_notes/)

The character design and animations are being designed separately and are
**not** specified yet — build against an animation-state interface, don't
invent art.

## Workspace layout

```
.
├── CLAUDE.md                       # ← you are here
├── package.json                    # pnpm workspace root, husky/lint-staged
├── pnpm-workspace.yaml             # packages: [extension]
├── .nvmrc                          # Node 22 (LTS)
├── .husky/pre-commit               # runs lint-staged
├── .github/
│   ├── workflows/ci.yml            # typecheck + lint + test+coverage
│   ├── workflows/release.yml       # tag vX.Y.Z → zip → GitHub release → Web Store
│   ├── workflows/design-doc.yml    # fails PRs touching load-bearing paths without docs/DESIGN.md
│   ├── dependabot.yml              # weekly npm + actions updates
│   └── PULL_REQUEST_TEMPLATE.md
├── docs/
│   ├── RUNNING.md, RELEASING.md    # run locally; cut a store release
│   ├── plans/                      # generated implementation plans (input to subagents)
│   ├── DESIGN.md                   # the design doc (authoritative): product, architecture, features, planned
│   └── archive/                    # desktop-era plans and specs, history only
├── reports/, research_notes/       # background research (progress visibility, competitors)
└── extension/                      # Chromium MV3 extension (WXT + React), the product
    ├── src/entrypoints/            # thin WXT entrypoints: background.ts, content/, popup/, options/, panel/, blocked/, welcome/
    ├── src/worker/                 # service-worker infra: controller, queue, alarms, reconcile, state-port
    ├── src/features/<name>/        # timer, tasks, auth, blocking, focus, calendar, buddy, site-access: pure logic + worker.ts handlers
    ├── src/shared/                 # cross-context: types, storage, messages, reconnect, host, with-timeout
    ├── src/ui/{components,hooks}/  # React views shared by popup, panel and options
    └── tests/                      # mirrors src/ (tests/worker, tests/features/<name>, tests/shared)
```

## Commands

All commands run from the **repo root**. The root scripts delegate into
`extension/` via `pnpm --filter ./extension`.

| Command                                 | What it does                                             |
| --------------------------------------- | -------------------------------------------------------- |
| `pnpm install`                          | Install everything + run husky `prepare`                 |
| `pnpm dev`                              | WXT dev mode (writes `extension/.output/chrome-mv3-dev`) |
| `pnpm build`                            | Production build (writes `extension/.output/chrome-mv3`) |
| `pnpm --filter ./extension run zip`     | Production build + store zip in `extension/.output/`     |
| `pnpm typecheck`                        | `tsc --noEmit` on the extension                          |
| `pnpm lint`                             | ESLint on the extension                                  |
| `pnpm test`                             | Vitest run (no coverage)                                 |
| `pnpm test:coverage`                    | Vitest run + v8 coverage report                          |
| `pnpm e2e`                              | Playwright e2e on the built extension (`pnpm build` first) |
| `pnpm --filter ./extension exec <tool>` | Run a tool binary inside the extension workspace         |

**Always use path-based filters (`--filter ./extension`)**, not name-based
(`-F plover`). See the `plover-pnpm-workspace` skill.

**Always use `pnpm --filter ./extension run <script>`** when the script name contains
a colon (e.g. `test:coverage`). See the `plover-pnpm-workspace` skill.

To run the extension locally (env vars, Supabase/Google OAuth redirect setup, manual
walkthrough), see [docs/RUNNING.md](docs/RUNNING.md).

## Architecture rules (load-bearing)

These are not style preferences (`docs/DESIGN.md` §2.3). Violating them defeats the point of
the design.

- **The background service worker owns all state** (timer, focus, blocking,
  tasks, calendar) and processes every mutation through a **single command
  queue**. Nothing else writes state.
- **The content script draws only the buddy blob and reads nothing from the
  page.** It holds no state and relays clicks to the worker.
- **Popup, options page, in-page panel and blocked page are thin, trusted
  views** that read and change state through the worker.
- **Secrets are never reachable from content scripts** (Supabase session,
  OAuth tokens); only the worker and extension pages touch them.
- **`worker.ts` files and `src/worker/*` are worker-only.** They register
  handlers and alarms and touch the command queue, so `src/ui/**` and the
  popup/options/panel/blocked/content entrypoints must never import them
  (ESLint `no-restricted-imports` enforces it). Pages talk to the worker via
  `@/shared/messages`.

## Hard constraints

- **Local-only data.** Tasks and history stay on the device (`chrome.storage.local`). Only settings may use
  the browser's own `chrome.storage.sync`. No Plover cloud sync.
- **The content script reads nothing from the page.** It only draws the buddy.
  No browsing-history logging.
- **Backend API Proxy.** Outbound Gemini API calls are proxied through a secure backend server to protect developer API keys in production.

- **Outbound HTTP allowlist:** the `plover-server` Cloud Run URL (task
  breakdown), the project's `*.supabase.co` (sign-in), `accounts.google.com`
  (Google OAuth via `launchWebAuthFlow`) and `www.googleapis.com` (Calendar
  API). Fonts and assets are bundled. This is a documented constraint, not a
  runtime-enforced gate.
- **Never capture keystroke content.** Counts only.
- **Never upload screenshots** anywhere except (later) Gemini Vision with
  explicit user consent surfaced in Settings.

## Scope (current: browser extension MVP, five features)

MVP principle: simple and not reliant on AI. Timer, blocking and focus work
without a model call; Gemini only suggests steps during task breakdown.

**In the MVP** (`docs/DESIGN.md` §1.5 and §4; planned work is §9 — the desktop
[mvp-five-features-roadmap](docs/archive/plans/mvp-five-features-roadmap.md) is superseded):

- Floating buddy on every page (content script, Shadow DOM) plus a toolbar
  popup with the same panel; drag to move, hide per site, hide everywhere,
  auto-hide in fullscreen; animation-state interface with placeholder art
- Task breakdown: Gemini-suggested steps, fully editable, with a no-AI fallback
- Pomodoro timer with one self-reported check-in per work block (MV3:
  `chrome.alarms` + stored end timestamps, never a ticking worker)
- Site/tab blocking built into the extension (`declarativeNetRequest`)
- Focus mode: timer + blocking + quiet buddy in one switch
- Read-only Google Calendar (`calendar.readonly`, via
  `chrome.identity.launchWebAuthFlow` so it works in all Chromium browsers)
- Required Supabase sign-in; all Chromium browsers (Chrome, Edge, Brave, Arc)

**Not in the MVP:**

- Stall nudge (dropped 2026-10-19; the focus-mode nudge in DESIGN §4.7 stays),
  gamification (planned next, after launch)
- Reading page content or browsing history, screen capture, blocking outside
  the browser
- Firefox/Safari, voice input, multi-account, plugins, mobile

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
- **No new deps unless used.** Add a dependency in the task that first imports it.
- **Keep coupled deps in version lockstep.** `react`/`react-dom`/`@types/react-dom`
  must share a major; a Dependabot bump to one and not the other renders a blank
  white screen. Watch Dependabot PRs that touch `react*`.
- **Tests:** TDD the pure logic in `extension/src/features/` and `src/shared/` (timer state machine,
  blocking rules, command queue). Skip TDD for UI scaffolding.
- **No real network in tests.** Stub `fetch` and use WXT's `fakeBrowser`; never hit a real endpoint.

## CI / dev tooling

- **CI** ([.github/workflows/ci.yml](.github/workflows/ci.yml)) runs on every
  PR + push to `main`: install → typecheck → lint → test. Coverage
  instrumentation + the coverage artifact upload only run on the `pull_request`
  trigger (that's the only place the 60% gate can still block a merge); the
  `push: main` run does a plain `pnpm test` to avoid paying for
  coverage overhead on a run with no PR left to gate. Ubuntu-only for now (add
  macOS/Windows when packaging matters). Each `push: main` run also bumps the patch version and publishes the zip as a
  GitHub pre-release; `store-daily.yml` submits the newest one to the Web Store
  every day (see `docs/RELEASING.md`).
- **Pre-commit** runs `lint-staged` via husky → eslint --fix + prettier --write
  on staged `extension/**/*.{ts,tsx,json,md,yml,yaml,css,html}`.
- **Coverage gate:** soft 60% (lines/branches/functions/statements) **only on**
  `extension/src/{features,shared,worker}/**`. UI and other code measured but
  not gated.
- **Dependabot** weekly PRs (npm root + npm extension/ + github-actions), minor/patch
  grouped, max 5 open per ecosystem.

## Known footguns → skills

The old "Lessons learned" log lived here and grew to 30+ entries loaded into
every session. Those domain-specific footguns now live as **on-demand reference
skills** under [`.claude/skills/plover-*`](.claude/skills/). Claude Code surfaces
each by its trigger `description`, so the relevant one loads only when you hit its
symptom — grep an error string or symptom and invoke the matching skill:

| Skill                    | Covers                                                                                                                                                                                                                            |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `plover-pnpm-workspace`  | pnpm `--filter` form, colon-scripts, `--coverage`, `onlyBuiltDependencies`, corepack-vs-corporate-registry                                                                                                                        |
| `plover-env-and-backend` | `WXT_*` env vars, backend port collision (404 on `/api/decompose`)                                                                                                                                                                |
| `plover-testing`         | vitest `vi.hoisted`, `noUncheckedIndexedAccess` destructure pattern, no-empty-function in mock classes                                                                                                                            |
| `plover-git-safety`      | subagent-worktree file tools, concurrent-checkout HEAD swaps, second checkout, PR base-branch                                                                                                                                     |
| `plover-auth`            | Auth unified on Supabase (Bearer token to `plover-server`); 401 sequencing across repos                                                                                                                                           |
| `plover-extension-wxt`   | WXT vitest plugin import path, tsconfig include breaking auto-imports/JSX, `wxt prepare` on first install, no-empty-function in background stub, storage.local access level + state port, fakeBrowser gaps, corepack pnpm timeout |

**Contract (replaces the old "add a lesson" rule):** when you hit an error,
surprise, or wrong-first-attempt a future Claude could avoid, add it to the most
relevant existing `plover-*` skill's Quick-reference table + Details (or create a
new `plover-*` skill via the `superpowers:writing-skills` skill) **before
reporting completion** — do NOT grow this file. If the footgun is actually an
always-true rule, promote it into the relevant rules section above instead.
