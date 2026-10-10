# Plan: MVP roadmap (five simple features)

## Context

The [pivot spec](../superpowers/specs/2026-10-02-desktop-buddy-pivot-spec.md)
(rev. 2026-10-03) narrows the MVP to five features hosted in the buddy
window: task breakdown, Pomodoro, site/tab blocking, focus mode and read-only
Google Calendar. The goal is a simple MVP that works without AI. Gemini only
suggests steps during breakdown.

This is a **roadmap plan**: it orders the work into milestones, each of which
ships as a small stack of PRs. Before delegating a milestone, write its own
detailed plan (`docs/plans/mvp-<milestone>.md`, using `writing-plans`) that
names exact files, tests and verification steps. Work one milestone at a
time. Don't fan out parallel subagents across milestones.

## What already exists (reuse, don't rebuild)

| Need | Existing code |
|---|---|
| Step suggestions | `app/src/main/planner/decompose.ts` (Gemini via `plover-server`) |
| Tasks/steps storage | `app/src/main/store/repos/tasks.ts`, `goals.ts` |
| Session storage | `sessions` table (`id, task_id, started_at, ended_at`) + `repos/sessions.ts` |
| Settings storage | `repos/settings.ts` |
| Always-on-top window | `app/src/main/windows/companion.ts`, `renderer/companion/` |
| Event bus | `app/src/main/events/bus.ts` |
| Google OAuth (PKCE) | `app/src/main/sync/google-auth.ts` |
| Calendar fetch | `app/src/main/sync/google/calendar-source.ts` (emits `calendar.event`) |

## Milestones

Order matters: M1 gives every later feature a home, M2 and M3 are
independent of each other, M4 needs M2, M5 needs M2+M3, M6 is independent.

### M1: Buddy shell and animation-state interface

- Define `BuddyState` (`idle | working | break | focus | nudging | celebrating`)
  in `app/src/shared/` and a single renderer component that maps state →
  placeholder visual (a simple shape with CSS transitions, no art).
- Rework `renderer/companion/` to host the buddy plus a small panel for the
  current task. Main window stays but is not the primary UI (spec §7 open
  question).
- Global hotkey opens the task panel.
- PRs: (1) shared state type + placeholder component, (2) companion window
  rework, (3) hotkey.
- Tests: none required (UI scaffolding); typecheck/lint must stay green.

### M2: Pomodoro timer

- `app/src/main/timer/`: a **pure** state machine (`work → shortBreak → … →
  longBreak`) with start/pause/resume/skip/stop, driven by an injectable clock.
  TDD it.
- A thin driver that ticks the machine and emits `timer.*` events on the bus.
- Store: migration adding `phase` and `planned_seconds` to `sessions`; extend
  `SessionsRepo`. Record each completed work block.
- Settings: work / short break / long break lengths, blocks-per-long-break.
- Buddy reacts to timer events (`working` / `break`).
- End-of-block check-in: "Which step did you finish?", where picking a step
  marks it done via `TasksRepo`.
- PRs: (1) timer state machine + tests, (2) sessions migration + repo, (3)
  driver + IPC + settings, (4) buddy UI + check-in.

### M3: Task breakdown with a no-AI fallback

- Reuse `decompose.ts` for suggestions. Add the fallback path: on Gemini
  error/429/timeout or "skip", return an empty step list instead of failing.
- Buddy panel: type task → suggested steps → edit/reorder/add/delete →
  start. Steps are checked off by hand.
- Ensure nothing in this flow touches the frozen scheduler (`schedule.ts`) or
  inference.
- PRs: (1) planner fallback + tests (nock fixtures for the error cases),
  (2) step editor UI.

### M4: Site/tab blocking

The largest new surface. Split into its own sub-plan before starting.

- **Extension package** `extension/` (add to `pnpm-workspace.yaml`): Chrome
  MV3, `declarativeNetRequest` dynamic rules redirecting blocked domains to
  an extension-bundled "blocked" page with the buddy placeholder. No
  `history`/`tabs` read permissions beyond what DNR needs.
- **Bridge** `app/src/main/blocker/`: localhost-only (127.0.0.1) WebSocket or
  HTTP endpoint on a fixed port with a per-install shared token (paired once
  via a code shown in Settings). Pushes `{ enabled, domains[] }`; the
  extension never sends browsing data back.
- Blocklist stored in settings; Settings UI to add/remove domains.
- Manual on/off toggle in the buddy (focus mode drives it in M5).
- Update the outbound allowlist docs to state the bridge is loopback-only.
- PRs: (1) blocklist storage + settings UI, (2) bridge + pairing, (3)
  extension skeleton + rule sync, (4) blocked page.
- Tests: TDD the domain-normalisation and rule-building helpers; bridge
  protocol unit tests. No real browser in CI.
- Capture any MV3/DNR footguns in a new `plover-browser-extension` skill.

### M5: Focus mode

- `app/src/main/focus/`: orchestrates timer (M2) + blocker (M4) + buddy
  state. Pure transition logic, TDD'd; side effects via the bus.
- Time-based nudges at a configurable interval while in focus.
- Ending focus (manual or session end) stops blocking and returns buddy to
  `idle`/`celebrating`.
- Calendar heads-up hook is a no-op until M6 lands.
- PRs: (1) focus orchestrator + tests, (2) nudge scheduling, (3) UI toggle.

### M6: Read-only Google Calendar

- Narrow `GOOGLE_API_SCOPES` in `google-auth.ts` to `calendar.readonly`.
  Existing users re-consent; there is no shipped user base to migrate.
- Wire `CalendarSource` into MVP flows: keep an in-memory "upcoming events"
  list, expose "next event" over IPC.
- Before starting a work block / focus: if an event starts within the block,
  offer "shorten to end before it" or "start anyway". Heads-up N minutes
  before an event during focus.
- Leave Gmail/Classroom/Drive/GitHub sources frozen and unwired.
- PRs: (1) scope narrowing, (2) upcoming-events service + tests, (3) buddy
  "next event" + pre-block conflict prompt, (4) focus heads-up.

## Cross-cutting

- Update `CLAUDE.md` "Scope" and README alongside the spec (done in the docs
  PR that introduces this plan).
- Every PR: `pnpm typecheck && pnpm lint && pnpm test` green. Coverage gate
  stays on `planner/**` and `store/**`; consider adding `timer/**` and
  `focus/**` to the gated set once they exist.
- Frozen code is not deleted in this roadmap.
- Website copy is being updated separately (see
  `docs/plans/website-mvp-refresh.md`).

## Verification (MVP done)

Manual walkthrough on the launch OS:

1. Open buddy via hotkey → type a task → get suggested steps → edit one.
2. Disconnect network → type a task → get an empty editable list, no error
   wall.
3. Start Pomodoro → buddy shows `working` → block ends → check-in ticks a step.
4. Add `youtube.com` to blocklist → start focus → YouTube shows the blocked
   page → end focus → YouTube loads.
5. Connect Google Calendar → buddy shows next event → start a 25-min focus
   with an event 10 min out → offered to shorten.
6. Confirm OAuth consent screen asks for calendar read-only only.
