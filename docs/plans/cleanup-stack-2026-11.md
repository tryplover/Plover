# Codebase cleanup stack (2026-11)

> **For agentic workers:** you will be assigned ONE section (PR 3–6). Implement only that section. Behaviour must not change: every existing test keeps passing unmodified unless the section says otherwise. Run `pnpm typecheck && pnpm lint && pnpm test` from the repo root at the end.

## Audit

Scope: `extension/` (~3,300 lines of source, ~3,200 of tests), docs, CI. Method: read the largest files, grep for duplication and dead exports, coverage report, docs classification. Score = (Impact + Risk) × (6 − Effort), each 1–5.

| # | Item | Type | Impact | Risk | Effort | Score | PR |
|---|---|---|---|---|---|---|---|
| A | `CLAUDE.md` states wrong facts every session loads: the outbound allowlist lists desktop-era hosts (Gmail, Classroom, GitHub, Gemini direct) and omits the two the extension actually calls (Supabase, `plover-server`); the PR template lists a different allowlist; the workspace layout misses `welcome/` and `features/site-access/`; "Stall nudge (dropped)" reads as if the focus-mode nudge were dropped too (it is in spec §4.5) | Docs | 4 | 3 | 1 | 35 | 1 |
| B | 38 of 49 files in `docs/plans/` and `docs/superpowers/specs/` describe the deleted Electron app (IPC, renderer, screen capture, activity tracking). They sit next to the live plans and mislead agents and readers | Docs | 3 | 2 | 1 | 25 | 2 |
| C | Showing a 60-second nudge is written twice (`focus/worker.ts`, `calendar/worker.ts`, each with its own `NUDGE_VISIBLE_MS`), and creating the focus-nudge alarm is written three times in `focus/worker.ts` | Code | 2 | 2 | 1 | 20 | 3 |
| D | `timer/worker.ts` `applyTransition` mixes pure bookkeeping (session log, `phaseStartedAt`, check-in flag) with side effects, using nested ternaries. The bookkeeping is the core of the timer and is only tested indirectly | Code | 3 | 2 | 2 | 20 | 4 |
| E | `content/index.tsx` (258 lines) holds three concerns: the settings hook, the draggable buddy view and the panel iframe. Its `useSyncedSettings` re-reads `storage.sync` on **every** storage change, including each `storage.local` write from the worker, on every open tab | Code | 2 | 2 | 2 | 16 | 5 |
| F | `Panel.tsx` (203 lines) inlines the running-task step list and a nested-ternary eyebrow | Code | 2 | 1 | 2 | 12 | 6 |
| G | Exports only used inside their own file (`GATED_COMMANDS`, `injectBuddy`, `applyTransition`, `CALENDAR_SCOPE`, a few types) | Code | 1 | 1 | 1 | 10 | — |
| H | `shared/storage.ts` is the least-covered gated file (63% statements: `updateSettings` path) | Tests | 1 | 2 | 1 | 15 | — |

Not debt: test coverage overall (96% statements in gated code), dependencies (updated 2026-11-05), release process (added 2026-11-07), `README.md` and `AGENTS.md` (current). G and H are left out of this stack: low value, and G adds churn to files other PRs touch.

## Stack

Each PR is based on the one before it and passes `pnpm typecheck && pnpm lint && pnpm test` on its own.

1. `docs: cleanup audit + fix stale CLAUDE.md facts` (this file, item A)
2. `docs: archive desktop-era plans and specs` (item B)
3. `refactor(focus,calendar): one nudge helper` (item C)
4. `refactor(timer): extract pure transition bookkeeping` (item D)
5. `refactor(content): split the content script; reload settings only on sync changes` (item E)
6. `refactor(ui): extract the active-task steps and eyebrow from Panel` (item F)

---

## PR 1 — CLAUDE.md facts (orchestrator, doc edit)

- **Outbound HTTP allowlist** → the hosts the extension really calls: the `plover-server` Cloud Run URL (task breakdown), the project's `*.supabase.co` (sign-in), `accounts.google.com` (Google OAuth via `launchWebAuthFlow`) and `www.googleapis.com` (Calendar API). Keep "documented constraint, not a runtime-enforced gate". Same list in `.github/PULL_REQUEST_TEMPLATE.md`.
- **Workspace layout:** add `welcome/` to the entrypoints list and `site-access` to the feature folders.
- **Not in the MVP:** "Stall nudge (dropped 2026-10-19; the focus-mode nudge in spec §4.5 stays)".

## PR 2 — archive desktop-era docs (orchestrator, `git mv` only)

- Move to `docs/archive/plans/`: every `docs/plans/*.md` except `buddy-round-sitter-art.md`, `chrome-extension-mvp.md`, `cleanup-stack-2026-11.md`, `extension-feature-folders.md`, `extension-optional-site-access.md`, `extension-release-pipeline.md`, `gcp-setup-details.md`, `popup-panel-figma-styling.md`.
- Move to `docs/archive/specs/`: everything under `docs/superpowers/specs/` except `2026-10-02-desktop-buddy-pivot-spec.md` and `2026-06-05-dependabot-pr-auto-heal-design.md` (the lockfile-fix workflow still runs).
- Add `docs/archive/README.md`: one paragraph — these describe the Electron desktop app deleted 2026-10-26; kept for history; not current direction.
- Update links in `CLAUDE.md`, `README.md`, `AGENTS.md` and the pivot spec that point at moved files. Links inside archived files are left as they are.

## PR 3 — one nudge helper (subagent)

Files: `extension/src/features/buddy/nudge.ts` (new), `features/focus/worker.ts`, `features/calendar/worker.ts`, tests.

- New `features/buddy/nudge.ts` exporting `NUDGE_VISIBLE_MS = 60_000` and `async function showNudge(text: string, now = Date.now()): Promise<void>` that reads `transient` with `getLocal` and writes `{ ...transient, nudgeText: text, nudgeUntil: now + NUDGE_VISIBLE_MS }` with `setLocal`. It is called from inside queued alarm handlers, so it must not `enqueue`.
- `focus/worker.ts`: replace the nudge write with `showNudge(...)`; add a local `async function scheduleFocusNudge(): Promise<void>` (reads `focusNudgeMinutes`, creates `NUDGE_ALARM` with `periodInMinutes`) and use it in all three places. Remove the local `NUDGE_VISIBLE_MS`.
- `calendar/worker.ts`: replace the heads-up write with `showNudge(\`${next.title} starts in 5 min\`, now)`; remove its `NUDGE_VISIBLE_MS`.
- Test `tests/features/buddy/nudge.test.ts`: sets text and `nudgeUntil = now + 60_000`, keeps other `transient` fields.

## PR 4 — pure transition bookkeeping (subagent)

Files: `extension/src/features/timer/bookkeeping.ts` (new), `features/timer/worker.ts`, `tests/features/timer/bookkeeping.test.ts` (new).

- New pure function in `bookkeeping.ts`:

```ts
export function bookkeep(
  prev: TimerState,
  t: TimerTransition,
  stored: { phaseStartedAt: number | null; activeTaskId: string | null; sessions: Session[]; transient: Transient },
  nowMs: number,
  newId: () => string,
): { phaseStartedAt: number | null; sessions: Session[]; transient: Transient; stopped: boolean }
```

  It holds exactly today's logic from `applyTransition`: append a work `Session` when leaving `work` (completed vs ended early, `endedAt` rules unchanged), `phaseStartedAt` (null when idle, `nowMs` on `phase-started`, else unchanged), `checkInPending` true on `work-block-completed`, false on `stopped`. Replace the nested ternaries with `if` statements. `newId` is injected so tests are deterministic; the worker passes `() => crypto.randomUUID()`.
- `applyTransition` becomes: read stored values → `bookkeep` → `setLocal({ timer: t.state, ...fields })` → notification clear / alarm / badge / listeners, unchanged.
- Tests: leaving work by completion (session completed, `endedAt = prev.phaseEndsAt`, check-in pending); stopping mid-work while paused (`endedAt = prev.pausedAt`, check-in cleared); a break→work `phase-started` sets `phaseStartedAt`; going idle nulls it; no session when the previous phase wasn't work. Existing `tests/features/timer/worker.test.ts` must pass unchanged.

## PR 5 — content script split (subagent)

Files: `extension/src/entrypoints/content/index.tsx`, new `content/BuddyView.tsx`, new `content/panel-frame.ts`, maybe `content/use-synced-settings.ts`.

- Move `BuddyApp`, `BuddyView`, `cornerStyle` and the drag/size constants they use into `BuddyView.tsx`; move `PanelFrame`, `placeFrame` and the iframe creation (`createIframeUi` options + the `show/hide` object) into `panel-frame.ts` as `export function createPanelFrame(ctx: ContentScriptContext): PanelFrame & { remove(): void }`. Constants shared by both (`MARGIN`, `BUDDY_HEIGHT`, `GAP`, `MENU_HEIGHT`) live in one place.
- `useSyncedSettings`: the listener reloads only when `area === "sync" && "settings" in changes`.
- `index.tsx` keeps `defineContentScript` and wiring only. In a directory entrypoint WXT only treats `index.tsx` as the entry, so the new files don't become entrypoints; confirm with `pnpm build` that `.output/chrome-mv3/manifest.json` is identical to the one built from the parent branch.
- No behaviour or style changes. The content script still reads nothing from the page except `location` and fullscreen state, as today.

## PR 6 — Panel extraction (subagent)

Files: `extension/src/ui/components/Panel.tsx`, new `ui/components/ActiveSteps.tsx`.

- Move the running-task step list (`<ul className="plover-steps">…</ul>` with the Now/Done classes and the `step/toggle` command) into `ActiveSteps({ task, currentStepId })`.
- Replace the eyebrow nested ternary with a small pure `function eyebrowFor(phase: TimerPhase, focusOn: boolean): string` in `Panel.tsx` using `if`/`switch`.
- Markup and class names unchanged.
