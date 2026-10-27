# AGENTS.md — context for autonomous coding agents

> This file is the single-source briefing for automated agents working in this repo.
> This file is intentionally trimmed to what an agent needs _before touching code in a sandbox_.

## TL;DR — what this repo is

**Plover** is a Chromium browser extension (Manifest V3): a small, cute
character that floats on every web page, plus a toolbar popup. The pnpm
workspace has one package, `extension/` (WXT + React). The former Electron
desktop app was deleted on 2026-10-26.

The MVP is: task breakdown (Gemini-suggested steps, fully editable, with a no-AI
fallback), a Pomodoro timer, site/tab blocking, focus mode and read-only Google
Calendar, all inside the extension, with required Supabase sign-in. The stall
nudge was dropped. Current direction is in the spec below.

The Gemini backend (`plover-server`) is a Python/FastAPI service in a standalone
repository, deployed on Google Cloud Run. It is not part of this repo.

Deferred (do **not** add): voice input, stall nudge, Firefox/Safari,
multi-account/plugins/multi-device sync.

Authoritative specs:

- Product spec (current direction, defines MVP scope; filename predates the extension pivot): [docs/superpowers/specs/2026-10-02-desktop-buddy-pivot-spec.md](docs/superpowers/specs/2026-10-02-desktop-buddy-pivot-spec.md)
- Superseded, history only: [docs/superpowers/specs/2026-05-24-task-tracker-agent-product-spec.md](docs/superpowers/specs/2026-05-24-task-tracker-agent-product-spec.md)

## Environment expectations (agent-specific)

- **Node 22** (see `.nvmrc`). `package.json#engines` accepts >= 20 but CI runs 22 — match that.
- **pnpm 10.26.0**, pinned via `packageManager` in the root `package.json`. Use corepack (`corepack enable && corepack prepare pnpm@10.26.0 --activate`) — do **not** install pnpm from `npm i -g` or you'll drift.
- **Setup script:** `./setup.sh` at the repo root does the install.
- **What agents can run:** `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm test:coverage`, `pnpm build`.
- **What agents cannot run:** `pnpm dev` (needs a GUI browser to load the extension). Don't try.
- **No secrets available.** Supabase and `WXT_GOOGLE_CLIENT_ID` values are absent in the sandbox. Any code path that hits the real network in a test is a bug — see the "no real network" convention below.

## Commands cheat-sheet

Run everything from the repo root.

| Command                                 | Purpose                                |
| --------------------------------------- | -------------------------------------- |
| `pnpm install`                          | Install workspace deps + husky prepare |
| `pnpm typecheck`                        | `tsc --noEmit` on `extension/`         |
| `pnpm lint`                             | ESLint on `extension/`                 |
| `pnpm test`                             | Vitest run                             |
| `pnpm test:coverage`                    | Vitest + v8 coverage                   |
| `pnpm build`                            | Production extension build             |
| `pnpm --filter ./extension exec <tool>` | Run a tool binary inside `extension/`  |

Two footguns baked into these commands (learned the hard way — see Lessons):

1. **Always use path-based filters** (`--filter ./extension`), never name-based (`-F plover` / `-F extension`).
2. **Colon scripts need explicit `run`.** Use `pnpm --filter ./extension run test:coverage`, not `pnpm --filter ./extension test:coverage`.

## Architecture rules (load-bearing — do not violate)

See spec §6. Crossing these defeats the whole design.

- **The background service worker owns all state** and processes every mutation through a single command queue.
- **The content script draws only the buddy blob and reads nothing from the page.**
- **Popup, options page, in-page panel and blocked page are thin, trusted views** over the worker.
- **Secrets are never reachable from content scripts.**

## Hard constraints (privacy / security)

- **Local-only user data.** `chrome.storage.local` (settings may use `chrome.storage.sync`). No Plover cloud sync.
- **Backend proxy for Gemini.** Outbound Gemini calls go through the standalone `plover-server` backend proxy so the API key isn't shipped in the extension. Do not inline API keys into `extension/`.
- **HTTP allowlist:** `generativelanguage.googleapis.com`, `www.googleapis.com`, `gmail.googleapis.com`, `calendar.googleapis.com`, `classroom.googleapis.com`, `api.github.com`, and Google OAuth (`oauth2.googleapis.com`, `accounts.google.com`). Documented constraint, not runtime-enforced.
- **Never capture keystroke content.** Counts only.
- **Never upload screenshots** anywhere (Vision integration is future work and gated on explicit user consent).

## Code conventions

- **TypeScript strict** with `noUncheckedIndexedAccess`, `noImplicitOverride`, `noFallthroughCasesInSwitch`. Do **not** loosen these to make an edit compile — restructure the code instead.
- **No comments** unless the _why_ is non-obvious. Don't explain _what_ — the code does that. Don't reference the current task/PR/issue in a comment.
- **No error handling for impossible states.** Validate at boundaries (user input, Google API responses); trust internal calls.
- **No premature abstractions.** Three similar lines beat a wrong helper.
- **No backwards-compat shims** for code that hasn't shipped yet — just change it.
- **New deps only when actually imported.** A package that runs install scripts must be listed in `pnpm-workspace.yaml` under `onlyBuiltDependencies`, or its postinstall is skipped.
- **Tests:** TDD the pure logic in `extension/src/lib/`. UI scaffolding can skip TDD.
- **No real network in tests.** Stub `fetch`; use WXT's `fakeBrowser`.

## Testing patterns agents will encounter

Idioms that show up all over `extension/tests/` and are worth internalizing before authoring new tests:

**Destructure + optional-chain, not `!`.** `noUncheckedIndexedAccess` makes `arr[0]` possibly-`undefined`, and ESLint's `no-non-null-assertion` blocks `arr[0]!`. Do this instead:

```ts
const result = listSomething();
expect(result).toHaveLength(2);
const [r0, r1] = result;
expect(r0?.kind).toBe("file_added");
```

**`vi.hoisted` for mock vars.** `vi.mock` is hoisted; anything it captures from the enclosing file must be declared via `vi.hoisted(() => ({...}))` or you'll get `ReferenceError: Cannot access 'x' before initialization`.

## Lessons learned that matter _for automated runs_

These are the subset an automated agent is most likely to trip on:

- **pnpm filter must be path-based** (`--filter ./extension`), not name-based.
- **Colon-named scripts** require the explicit `run` keyword under `--filter`.
- **`onlyBuiltDependencies`** lives in `pnpm-workspace.yaml`, not `package.json`. It currently gates postinstall for `esbuild`.
- **Corepack behind a corporate registry can hang.** If `pnpm install` blocks on `registry.npmjs.org`, the fix is to prepend a globally-installed pnpm to `PATH`.
- **Backend port must match `WXT_PLOVER_BACKEND_URL`.** The standalone `plover-server` listens on `PORT` (see its README). If the port is occupied, local decomposition requests fail with 404.

## Verification before claiming done

Before saying a change is complete, run — and confirm green output for — all three:

```bash
pnpm typecheck && pnpm lint && pnpm test
```

## When in doubt

1. Re-read the product spec at `docs/superpowers/specs/2026-10-02-desktop-buddy-pivot-spec.md`.
2. Grep the tests — they encode the invariants the code must preserve.
3. If a design decision isn't in the specs and isn't obvious from the code, leave a `TODO(scope):` in the PR body (not the code) and ask.
