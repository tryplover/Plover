# Plover — Desktop Buddy Pivot Spec

**Date:** 2026-10-02 (rev. 2026-10-03: MVP narrowed to five simple features)
**Status:** Draft v2. Supersedes the [2026-05-24 product spec](2026-05-24-task-tracker-agent-product-spec.md) as the product direction.
**Launch:** waitlist-only on tryplover.com (downloads paused since 2026-09-20).

## 1. Vision

Plover becomes a small, cute character that lives on your desktop and keeps
you company while you work. You tell it what you're about to do; it helps you
break the task down, runs a Pomodoro timer, blocks the tabs that pull you
away, and keeps an eye on your calendar so a focus block doesn't run into a
meeting. It should feel like a little work buddy that's alive on your laptop,
not a dashboard, a planner or a monitor.

The old product sold *progress visibility* (an AI-estimated bar that fills as
work happens). The pivot sells *company and momentum*: a friendly presence
that makes starting and staying on a task easier.

**MVP principle: simple, and not reliant on AI.** Every MVP feature works
without a model call. AI shows up in exactly one place, suggesting steps
during task breakdown, and even there the user can write or edit the steps
by hand. Gamification and smarter features get layered on after launch, once
we've learned what people actually use.

## 2. Target user

The same solo knowledge worker or student as before: someone on long,
self-directed tasks (essays, problem sets, drafts, side projects) who
struggles to start and to stay on one thing. Skews toward people who find
plain timers and to-do lists too cold to stick with, and who respond to a
character more than to a chart (the Finch / Duolingo-owl / Forest audience),
but on the desktop, where the work actually happens.

## 3. Character and feel

- **Direction:** a minimalist, cute little assistant with clean, smooth
  animations. Reference points: ChatGPT's voice-mode dots, Meta's Muse, and
  Grok's bot. Simple shapes, expressive through motion rather than detail.
- **Presence:** sits on the desktop in a small, always-on-top, frameless
  window. Never blocks the work; can be moved, minimized or dismissed.
- **Tone:** encouraging and non-judgmental. Drifting off task gets a gentle
  "come back" and never a guilt-trip, streak reset or punishment.
- **Design: open.** Character design, the animation set and the visual
  identity are being designed separately and are deliberately not specified
  here. Engineering builds against an animation-state interface (e.g. `idle`,
  `working`, `break`, `focus`, `nudging`, `celebrating`) so art can drop in
  later without reworking behaviour.

## 4. MVP features

The buddy window is the shell. It hosts five features.

### 4.1 Task breakdown

1. User clicks the buddy (or hits the global hotkey) and types a task:
   "Write the intro section of my history essay."
2. Plover suggests a short list of concrete steps (Gemini, via the existing
   Planner and `plover-server` proxy).
3. User accepts, edits, reorders, deletes or adds steps, then starts.
4. **Works without AI:** if the Gemini call fails, is rate-limited or the user
   skips it, they get an empty step list to fill in by hand. No flow is
   blocked on the model.
5. Steps are checked off by hand. There is no AI progress estimate.

### 4.2 Pomodoro timer

- Work/break cycles: default 25 min work / 5 min short break / 15 min long
  break after every 4 work blocks. All lengths are configurable.
- Start, pause, skip and stop from the buddy. The buddy's animation state
  follows the timer (`working` during work, `break` during breaks).
- At the end of each work block the buddy asks one self-reported question:
  "Which step did you finish?" Answering ticks the step off. That's the whole
  check-in for the MVP.
- Completed sessions are stored locally (`sessions` table) so later
  gamification has history to build on. No stats UI in the MVP.

### 4.3 Site and tab blocking

- The user keeps a blocklist of sites (e.g. `youtube.com`, `reddit.com`,
  `x.com`). While blocking is on, opening one of those sites shows a calm
  "this one's blocked until your focus block ends" page with the buddy on it,
  instead of the site.
- Blocking is only ever on during a focus session (§4.4) or when the user
  turns it on by hand. It turns off automatically when the session ends.
- **Mechanism (MVP):** a companion browser extension (Chrome / Chromium
  first, Manifest V3 `declarativeNetRequest`) that receives the blocklist and
  the on/off state from the desktop app over a localhost-only channel. The
  extension never reports browsing history back to the app. It only enforces
  rules it is given.
- Rejected for the MVP: editing the OS `hosts` file (needs admin rights and
  can't show a friendly page); detecting the active window (that's activity
  monitoring, which stays frozen and would need Screen Recording /
  Accessibility permissions).
- Blocking desktop apps (not browser tabs) is out of scope for the MVP.

### 4.4 Focus mode

Focus mode is the one "lock in" switch that ties the other features
together. Turning it on:

1. Starts (or resumes) the Pomodoro timer on the current task.
2. Turns on site blocking for the length of the session.
3. Moves the buddy into its `focus` state: smaller, quieter, no chatter
   except time-based gentle nudges ("still on the intro?") at a
   configurable interval, plus the end-of-block check-in.
4. Shows a heads-up if a calendar event starts before the work block would
   end (§4.5).

Turning it off, or finishing the session, reverses all of it. Focus mode does
not change OS settings (no system Do Not Disturb toggle in the MVP).

### 4.5 Calendar integration

- Optional Google Calendar connection, **read-only**
  (`calendar.readonly` scope, primary calendar only).
- The buddy shows the next event ("Stand-up in 40 min").
- Before starting a work block or focus mode, if an event starts during the
  block, the buddy offers to shorten the block to end before it, or start
  anyway.
- A gentle heads-up a few minutes before an event starts during focus mode.
- Event data is used in memory and cached locally only. Nothing is written
  to the calendar in the MVP.
- Reuses the existing Google OAuth and `CalendarSource` code; the OAuth
  request is narrowed to the calendar scope alone (no Gmail, Drive, Docs or
  Classroom scopes).

### 4.6 Settings (minimal)

Timer lengths, nudge interval, blocklist, calendar connect/disconnect, and the
global hotkey. Nothing else.

## 5. Scope

### MVP (waitlist launch)

- Buddy window with an animation-state interface (placeholder art until the
  design lands)
- Task breakdown with AI-suggested, fully editable steps
- Pomodoro timer with one self-reported check-in per work block
- Site/tab blocking via a companion browser extension
- Focus mode tying timer + blocking + quiet buddy together
- Read-only Google Calendar integration
- Minimal settings

### After the MVP (not committed, in rough order of interest)

- Gamification: streaks that never punish, buddy reactions and unlocks,
  session history and stats
- Smarter nudges and check-ins ("stuck? want me to split this step?")
- Writing focus blocks to the calendar
- Blocking desktop apps, Firefox/Safari extensions

### Explicit non-goals for the MVP

- No AI progress tracking or inference (frozen, see §6).
- No screen capture, window-title logging or keystroke counting.
- No auto-scheduling into working-hours windows.
- No Gmail, Drive, Docs, Classroom or GitHub connectors.
- No OS-level changes (hosts file, system Do Not Disturb).
- No voice input, no mobile app, no team features.

## 6. What carries over from the current app

| Area | Fate | Notes |
|---|---|---|
| Planner (Gemini decomposition, `app/src/main/planner/decompose.ts`) | **Keep** | Becomes task breakdown (§4.1). Needs a graceful no-AI fallback. |
| Store (SQLite + typed repos) | **Keep** | Tasks/steps live locally. `sessions` gains Pomodoro fields (phase, planned length). New `blocklist` storage, likely in `settings`. |
| Companion window (`app/src/main/windows/companion.ts`, `renderer/companion/`) | **Keep, rework** | Frameless always-on-top window is the buddy's home; contents get replaced. |
| Gemini proxy (`plover-server`) and Supabase auth | **Keep** | Unchanged. |
| Google OAuth (`app/src/main/sync/google-auth.ts`) + `CalendarSource` | **Un-freeze (calendar only)** | Narrow scopes to `calendar.readonly`. Calendar is the only connector in the MVP. |
| Gmail, Classroom, Drive/Docs, GitHub sources | **Freeze** | Leave in place, not wired into MVP flows; their scopes are dropped from the OAuth request. |
| Activity monitoring (`app/src/main/activity/`) | **Freeze** | Leave the code in place, turn it off by default, build nothing new on it. |
| Inference / progress signals, `+X%` pops, blended goal bar | **Freeze** | Same. The `progress-signal-rewire` plan is paused. |
| Working-hours scheduler (`planner/schedule.ts`), Today / Goals views | **Freeze** | Replaced by the buddy's task-at-hand flow; decide later whether to delete. |

"Freeze" means: don't extend it, don't delete it yet, and don't let new code
depend on it. Deletion is a separate decision once the MVP is clear.

New pieces:

- **Timer** module in the main process (pure state machine + a ticking
  driver), emitting events on the bus.
- **Focus** module that orchestrates timer + blocking + buddy state.
- **Blocker bridge**: a localhost-only server in the main process that the
  extension connects to. The browser extension itself lives in a new
  workspace package (`extension/`).

## 7. Open questions

- **Character and animations**: pending the separate design work.
- **Platform**: the old spec was mac-first; the team develops on Windows.
  Which OS does the waitlist launch target? (The extension approach for
  blocking works the same on both.)
- **Extension distribution**: Chrome Web Store listing, or load-unpacked for
  the waitlist beta? The store listing needs a privacy policy and review time.
- **Blocking strictness**: can the user end a blocked session early with one
  click, or is there a small speed bump (e.g. "type why")? Default proposed:
  one click, no guilt.
- **Main window**: does the MVP keep a main window at all, or is the buddy
  plus a small settings window the whole UI?
- **Timer defaults**: Pomodoro 25/5 is the proposed default; offer a 50/10
  "deep work" preset too?
- **Calendar scope**: primary calendar only, or let the user pick calendars?

## 8. Background

- [Progress visibility motivation evidence](../../../reports/Progress%20visibility%20motivation%20evidence.md)
  and its [research notes](../../../research_notes/): the research behind the
  old thesis, including the competitive landscape. Its finding that task
  decomposition, overlays and screen capture are commodities is part of why
  the product is now differentiated by character and feel rather than by
  tracking.
- Companion-productivity research (Finch, Duolingo, Forest, Sprout, Otto)
  from 2026-09-09 concluded the cute-companion niche is mostly mobile-only and
  that nobody owns the desktop moment.
