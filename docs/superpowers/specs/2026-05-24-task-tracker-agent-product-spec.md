# Tendril — Product Spec (PRD)

**Working name:** Tendril
**Date:** 2026-05-24
**Status:** Draft v1
**Timeline:** 3-month Gemini hackathon

## 1. Vision

A local, always-on agent that turns vague goals into a calendar and shepherds you toward finishing them. You tell it what you want to get done — by voice or text, in any wording. It decomposes the goal, books time on your calendar, watches your screen and files in the background, and tells you when you're on or off track. The agent is private by design: nothing leaves your machine except calls to Gemini and Google APIs.

## 2. Target user

A focused knowledge worker / student / builder who:

- Lives in Google Calendar and Google Docs
- Has more goals than free hours
- Wants a system that reduces planning overhead, not adds to it
- Trusts a local-only privacy posture more than a SaaS dashboard

## 3. Core user flows

### 3.1 Add a goal

1. User invokes the overlay (global hotkey, e.g. `⌥-Space`).
2. Speaks or types: "Finish the GPU profiler write-up by Friday, ~4 hrs of work."
3. Agent calls Gemini with the user's goal + recent activity context.
4. Gemini returns: a structured goal, 3–7 subtasks with effort estimates, dependencies, and suggested deadlines.
5. Agent surfaces the breakdown for one-tap accept / edit.
6. On accept, agent schedules subtasks into open Google Calendar slots respecting working hours and existing events.

### 3.2 Daily check-in

- Every morning at the user's start time, agent shows: today's scheduled tasks, what's overdue, what's at risk, and a one-line summary of yesterday's progress per active goal.
- User can re-prompt the agent ("push the profiler doc to Saturday") and the agent re-schedules.

### 3.3 Passive monitoring → progress inference

- Monitor module records: screenshot every N minutes, active window title on focus change, foreground app time, keystroke count per minute (**counts only — never key content**), Google Docs revisions per tracked doc, file mtimes in user-configured folders.
- Inference module periodically (e.g. every 30 min) summarizes the last window using Gemini Vision + window-title text and emits a `progress_signal` per active task.

### 3.4 Nudges and warnings

- Nudge engine combines deterministic rules (deadline math, calendar slip) with LLM judgment over recent progress signals.
- Surfaces: overlay glance, native notification, end-of-day digest.
- Examples:
  - "You blocked 2 hrs for the profiler doc but spent it in Slack — want me to reschedule?"
  - "Goal X has no activity in 6 days; demote or drop?"

### 3.5 Voice in

- Voice capture button on overlay (or push-to-talk hotkey).
- `whisper.cpp` transcribes locally; text is sent to the same capture pipeline as typed input.

## 4. Feature scope

### v1 (must ship)

- Goal & task data model (SQLite)
- Goal capture (typed) → Gemini subtask decomposition
- Google Calendar OAuth + slot-finder + event writer
- Daily + long-term todo views (main window)
- Overlay window (transparent, frameless, always-on-top, hotkey)
- Screenshot loop + active-window-title logger (macOS first)
- Inference pass over recent activity → progress signal per task
- Native notifications + overlay nudges
- Settings: permissions wizard, pause-monitoring, blackout app list

### v1.5

- Voice input (whisper.cpp)
- Google Docs revision-history poller
- Daily morning digest
- Windows port (parity with macOS)

### v2 (stretch)

- Multi-device sync (still local-first; LAN sync, no cloud)
- Plugin hooks (custom data sources)
- Smart focus mode (auto-DND, app limits during scheduled blocks)

### Explicit non-goals

- No team / shared workspaces.
- No cloud backend.
- No keystroke content capture, ever. Counts only.
- No mobile companion in v1.

## 5. Privacy & permissions

- All persistent data stored in `~/Library/Application Support/<app>` (macOS) and `%APPDATA%/<app>` (Windows).
- Outbound network limited to: `generativelanguage.googleapis.com` (Gemini), `www.googleapis.com` (Calendar/Docs), and the Google OAuth endpoints.
- Permissions required:
  - **macOS**: Screen Recording, Accessibility, Input Monitoring, Notifications. Granted via TCC; the app surfaces a guided permissions wizard. **Not** literal root.
  - **Windows**: UAC elevation on first run for global hooks (`SetWindowsHookEx`) and screen capture. Then runs at user level for normal operation where possible.
- A visible "monitor active" indicator is always present on the overlay. Pause toggles a kill-switch on screenshot + keystroke counters within 1 frame.
- Per-app blackout list: screenshots from blacklisted bundle IDs / window titles are dropped before being written to disk.

## 6. Architecture overview

```
+--------------------- Electron main process ----------------------+
|  Capture                    Planner                Nudge Engine  |
|  - text / quick-add         - Gemini tool-calling  - rules + LLM |
|  - overlay quick-add        - goal -> subtasks     - notif + UI  |
|  - voice (whisper.cpp)      - schedule planner                   |
|                                                                  |
|  Monitor (privileged)        Inference              Sync         |
|  - screenshot loop           - Gemini Vision        - Google     |
|  - active window title       - text reasoning         Calendar   |
|  - foreground time           - progress signals     - Google     |
|  - keystroke counter           per task               Docs API   |
|                                                                  |
|  Store: SQLite (goals, tasks, sessions, activity, summaries)     |
+------------------------------------------------------------------+
            |                                  |
   Overlay BrowserWindow              Main BrowserWindow
   (transparent, frameless,           (settings, tasks list,
   always-on-top, click-through       goal entry, progress dash)
   when idle)
```

Key contracts:

- **Store** exposes typed repositories: `Goals`, `Tasks`, `Sessions`, `Activity`, `Summaries`. Modules never reach into raw SQLite.
- **Planner** is a function: `(goal_text, context) -> {goal, subtasks[]}`. Pure on inputs; side-effectful only through `Store` and `Sync`.
- **Monitor** writes to `Activity` only. Never reads other tables.
- **Inference** reads `Activity` + `Tasks`, writes `Summaries` + `progress_signal` events. Never schedules.
- **NudgeEngine** reads `Tasks` + `Summaries`, writes notifications + overlay events. Never mutates tasks.
- **Sync** is the only module that talks to Google APIs.

This separation means a teammate can rebuild any module without touching the others.

## 7. Milestones (3 months)

| Week | Milestone |
|---|---|
| 1 | Electron shell + main window scaffold, SQLite store + repositories, settings page |
| 2 | Gemini client wrapper + tool definitions, Planner v1 (text-only goal entry) |
| 3 | Google Calendar OAuth + slot-finder + event write-back |
| 4 | Daily / long-term todo views; end-to-end demo: type goal → see scheduled events |
| 5 | Overlay window, global hotkey, quick-add UX |
| 6 | macOS Monitor: screenshot loop + active-window-title via accessibility |
| 7 | Inference pass (Gemini Vision + text), `progress_signal` table |
| 8 | NudgeEngine v1 + native notifications + overlay nudges |
| 9 | Voice input via whisper.cpp; Google Docs revisions poller |
| 10 | Windows port — Monitor parity, installer |
| 11 | Permissions wizard, blackout list, pause kill-switch, polish |
| 12 | Hackathon demo: install → grant perms → speak goal → calendar fills → work → get nudge |

## 8. Success metrics (demo-grade)

- < 60s from "fresh install" to "first goal scheduled on calendar"
- Subtask breakdowns rated useful by user in ≥ 70% of trials
- Nudge precision ≥ 60% (user accepts the nudge or takes the suggested action)
- Zero outbound traffic outside the allowed domain list (verified by network capture)

## 9. Open questions

- Slot-finder policy: pack early vs. spread across the week? Default and override.
- How much past activity is enough context for Gemini without blowing token budget? Likely a rolling summary + last 24h raw.
- Multi-Google-account support — v1 single account, but model it accordingly.
