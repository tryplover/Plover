# Plover — Desktop Buddy Pivot Spec

**Date:** 2026-10-02
**Status:** Draft v1. Supersedes the [2026-05-24 product spec](2026-05-24-task-tracker-agent-product-spec.md) as the product direction.
**Launch:** waitlist-only on tryplover.com (downloads paused since 2026-09-20).

## 1. Vision

Plover becomes a small, cute character that lives on your desktop and keeps
you company while you work. You tell it what you're about to do; it breaks the
task into steps, runs a focus timer, nudges you back when you drift, and
checks in on how it's going. It should feel like a little work buddy that's
alive on your laptop — not a dashboard, not a planner, not a monitor.

The old product sold *progress visibility* (an AI-estimated bar that fills as
work happens). The pivot sells *company and momentum*: a friendly presence
that makes starting and staying on a task easier.

## 2. Target user

The same solo knowledge worker / student as before — someone on long,
self-directed tasks (essays, problem sets, drafts, side projects) who
struggles to start and to stay on one thing. Skews toward people who find
plain timers and to-do lists too cold to stick with, and who respond to a
character more than to a chart (the Finch / Duolingo-owl / Forest audience),
but on the desktop, where the work actually happens.

## 3. Character and feel

- **Direction:** a minimalist, cute little assistant with clean, smooth
  animations. Reference points: ChatGPT's voice-mode dots, Meta's Muse, and
  Grok's bot — simple shapes, expressive through motion rather than detail.
- **Presence:** sits on the desktop in a small, always-on-top, frameless
  window. Never blocks the work; can be moved, minimized, or dismissed.
- **Tone:** encouraging and non-judgmental. Drifting off task gets a gentle
  "come back" and never a guilt-trip, streak reset, or punishment.
- **Design: open.** Character design, the animation set, and the visual
  identity are being designed separately and are deliberately not specified
  here. Engineering should build against an animation-state interface
  (e.g. `idle`, `working`, `checking-in`, `celebrating`, `nudging`) so art can
  drop in later without reworking behaviour.

## 4. Core user flows

### 4.1 Tell it what you're doing

1. User clicks the buddy (or hits the global hotkey) and types a task:
   "Write the intro section of my history essay."
2. Gemini breaks it into a short list of concrete steps.
3. User accepts or edits the steps, then starts.

### 4.2 Focus timer

- Starting a task starts a timer (default length configurable; Pomodoro-style
  work/break cycles are the expected default).
- The buddy shows it's "working with you" while the timer runs and marks
  breaks and the end of a session.

### 4.3 Lock-in reminders

- While a session runs, the buddy periodically reminds the user to stay on the
  task at hand, in character.
- v1 reminders are time-based (driven by the session timer), not driven by
  watching the screen. See §7 for the open question on distraction detection.

### 4.4 Check-ins

- At intervals during a session (and at its end) the buddy asks how it's
  going: which step you're on, whether you're stuck, whether to keep going.
- Answers are **self-reported**. They update step status directly (done /
  still working / stuck) — there is no AI progress estimate behind them.
- A "stuck" answer can offer to re-break the current step into smaller ones.

## 5. Scope

### v1 (waitlist launch)

- Desktop buddy window with an animation-state interface (placeholder art
  until the design lands)
- Typed task entry → Gemini step breakdown → accept/edit
- Focus timer with work/break cycles
- Time-based lock-in reminders
- Self-reported check-ins that update step status
- Minimal settings: timer lengths, reminder/check-in frequency, hotkey

### Explicit non-goals for v1

- No AI progress tracking or inference (frozen — see §6).
- No screen capture, window-title logging, or keystroke counting.
- No scheduling into working-hours windows / calendar-style planning.
- No Google / GitHub context connectors.
- No voice input, no mobile app, no team features.

## 6. What carries over from the current app

| Area | Fate | Notes |
|---|---|---|
| Planner (Gemini decomposition, `app/src/main/planner/`) | **Keep** | Becomes the step breakdown in §4.1. |
| Store (SQLite + typed repos) | **Keep** | Tasks/steps and sessions still live locally. Timer sessions may need new columns or a repo. |
| Overlay / companion windows (`app/src/main/windows/`, `renderer/companion/`) | **Keep, rework** | Frameless always-on-top window is the buddy's home; contents get replaced. |
| Gemini proxy (`plover-server`) and Supabase auth | **Keep** | Unchanged. |
| Activity monitoring (`app/src/main/activity/`) | **Freeze** | Leave the code in place, turn it off by default, build nothing new on it. |
| Inference / progress signals, `+X%` pops, blended goal bar | **Freeze** | Same. The `progress-signal-rewire` plan is paused. |
| Sync connectors (Google, GitHub) | **Freeze** | Not used by v1 flows. |
| Working-hours scheduler, Today / Goals views | **Freeze** | Replaced by the buddy's task-at-hand flow; decide later whether to delete. |

"Freeze" means: don't extend it, don't delete it yet, and don't let new code
depend on it. Deletion is a separate decision once v1 is clear.

## 7. Open questions

- **Character and animations** — pending the separate design work.
- **Distraction detection** — should lock-in reminders ever react to what's
  actually on screen (e.g. switching to a distracting app)? That would
  un-freeze part of activity monitoring and reintroduce permission friction.
  v1 says no.
- **Platform** — the old spec was mac-first; the team develops on Windows.
  Which OS does the waitlist launch target?
- **Main window** — does v1 keep a main window at all, or is the buddy the
  whole UI?
- **Timer defaults** — Pomodoro 25/5, or something longer for deep work?

## 8. Background

- [Progress visibility motivation evidence](../../../reports/Progress%20visibility%20motivation%20evidence.md)
  and its [research notes](../../../research_notes/) — the research behind the
  old thesis, including the competitive landscape. Its finding that task
  decomposition, overlays, and screen capture are commodities is part of why
  the product is now differentiated by character and feel rather than by
  tracking.
- Companion-productivity research (Finch, Duolingo, Forest, Sprout, Otto)
  from 2026-09-09 concluded the cute-companion niche is mostly mobile-only and
  that nobody owns the desktop moment.
