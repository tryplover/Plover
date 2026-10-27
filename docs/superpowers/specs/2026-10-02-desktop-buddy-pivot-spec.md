# Plover — Browser Buddy Spec (Chrome extension)

**Date:** 2026-10-02 (rev. 2026-10-03: MVP narrowed to five simple features; rev. 2026-10-13: stall nudge added, progress percentages and the goal bar removed; **rev. 2026-10-19: Plover becomes a Chromium browser extension instead of an Electron desktop app; stall nudge dropped**; **rev. 2026-10-26: Electron app deleted**)
**Status:** Draft v3. Supersedes the [2026-05-24 product spec](2026-05-24-task-tracker-agent-product-spec.md) as the product direction. The filename still says "desktop buddy" so existing links keep working.
**Launch:** waitlist-only on tryplover.com, distributed as an unlisted Chrome Web Store listing (downloads of the desktop app paused since 2026-09-20).

## 1. Vision

Plover is a small, cute character that lives in your browser and keeps you
company while you work. You tell it what you're about to do; it helps you
break the task down, runs a Pomodoro timer, blocks the tabs that pull you
away, and keeps an eye on your calendar so a focus block doesn't run into a
meeting. It should feel like a little work buddy that's alive on the pages
you work in, not a dashboard, a planner or a monitor.

**Why an extension, not a desktop app (rev. 2026-10-19).** The desktop app
needed an Electron shell, native modules, OS packaging and signing, and a
separate companion extension plus a localhost bridge just to block tabs.
Most of the target user's work already happens in the browser (Docs,
Notion, Overleaf, web IDEs). Making Plover the extension itself removes the
desktop app, the bridge and the install friction: one "Add to Chrome" click
and the buddy is there.

**MVP principle: simple, and not reliant on AI.** Timer, blocking and focus
mode work without a model call. AI shows up in exactly one place,
suggesting steps during task breakdown, and the user can always write or
edit the steps by hand. Gamification and smarter features get layered on
after launch, once we've learned what people actually use.

## 2. Target user

The same solo knowledge worker or student as before: someone on long,
self-directed tasks (essays, problem sets, drafts, side projects) who
struggles to start and to stay on one thing, and does most of that work in
a Chromium browser. Skews toward people who find plain timers and to-do
lists too cold to stick with, and who respond to a character more than to a
chart (the Finch / Duolingo-owl / Forest audience).

## 3. Character and feel

- **Direction:** a minimalist, cute little assistant with clean, smooth
  animations. Reference points: ChatGPT's voice-mode dots, Meta's Muse, and
  Grok's bot. Simple shapes, expressive through motion rather than detail.
- **Presence:** floats in a corner of every web page (bottom-right by
  default). Never blocks the work; see §4.1 for moving and hiding it.
- **Tone:** encouraging and non-judgmental. Drifting off task gets a gentle
  "come back" and never a guilt-trip, streak reset or punishment.
- **Design: open.** Character design, the animation set and the visual
  identity are being designed separately and are deliberately not specified
  here. Engineering builds against an animation-state interface (`idle`,
  `working`, `break`, `focus`, `nudging`, `celebrating`) so art can drop in
  later without reworking behaviour.

## 4. MVP features

### 4.1 The buddy and its controls

The extension has three surfaces, all showing the same state:

1. **Floating buddy** (content script). Injected on every normal web page,
   rendered inside a Shadow DOM root so page CSS can't break it and it can't
   break the page. Clicking it opens a small panel: current task and step,
   timer, pause/skip/stop, and the focus switch.
2. **Toolbar popup** (the extension icon). Opens the same panel plus a link
   to settings. This is the fallback on pages where content scripts can't
   run (`chrome://` pages, the Web Store, the PDF viewer, the new tab page).
   The icon badge shows the minutes left in the current block.
3. **Options page**: settings (§4.7).

Moving and hiding the buddy:

- **Drag to move.** The buddy can be dragged to any corner; the position is
  remembered and synced as a setting.
- **Hide on this site.** A per-site "don't show here" list (e.g. Figma,
  video calls).
- **Hide everywhere.** One switch that turns the floating buddy off; timer,
  blocking and focus keep working from the toolbar popup.
- **Auto-hide in fullscreen.** The buddy hides while a page is fullscreen
  (video, slides).

### 4.2 Task breakdown

1. User clicks the buddy (or presses the extension's keyboard shortcut) and
   types a task: "Write the intro section of my history essay."
2. Plover suggests a short list of concrete steps (Gemini, via the
   `plover-server` proxy).
3. User accepts, edits, reorders, deletes or adds steps, then starts.
4. **Works without AI:** if the Gemini call fails, is rate-limited or the
   user skips it, they get an empty step list to fill in by hand. No flow is
   blocked on the model.
5. Steps are checked off by hand. There is no AI progress estimate.

### 4.3 Pomodoro timer

- Work/break cycles: default 25 min work / 5 min short break / 15 min long
  break after every 4 work blocks. All lengths are configurable.
- Start, pause, skip and stop from the buddy panel or the popup. The buddy's
  animation state follows the timer (`working` during work, `break` during
  breaks) on every open tab.
- At the end of each work block the buddy asks one self-reported question:
  "Which step did you finish?" Answering ticks the step off. That's the whole
  check-in for the MVP. If no page with the buddy is visible, a system
  notification carries the prompt.
- **MV3 constraint:** the background service worker can be suspended at any
  time, so the timer is stored as a phase plus an end timestamp, not as a
  ticking counter. `chrome.alarms` fires the phase change; every surface
  computes the remaining time from the timestamp.
- Completed sessions are stored locally so later gamification has history
  to build on. No stats UI in the MVP.

### 4.4 Site and tab blocking

- The user keeps a blocklist of sites (e.g. `youtube.com`, `reddit.com`,
  `x.com`). While blocking is on, opening one of those sites redirects to a
  calm extension page, "this one's blocked until your focus block ends",
  with the buddy on it.
- Blocking is only ever on during a focus session (§4.5) or when the user
  turns it on by hand. It turns off automatically when the session ends.
- **Mechanism:** Manifest V3 `declarativeNetRequest` dynamic rules, set and
  cleared by the extension itself. No desktop app and no localhost bridge.
  The extension never records which sites the user visits; it only enforces
  the rules.
- Blocking desktop apps and anything outside the browser is out of scope.

### 4.5 Focus mode

Focus mode is the one "lock in" switch that ties the other features
together. Turning it on:

1. Starts (or resumes) the Pomodoro timer on the current task.
2. Turns on site blocking for the length of the session.
3. Moves the buddy into its `focus` state: smaller, quieter, no chatter
   except time-based gentle nudges ("still on the intro?") at a
   configurable interval, plus the end-of-block check-in.
4. Shows a heads-up if a calendar event starts before the work block would
   end (§4.6).

Turning it off, or finishing the session, reverses all of it. Focus mode
changes nothing outside the browser.

### 4.6 Calendar integration

- Optional Google Calendar connection, **read-only**
  (`calendar.readonly` scope, primary calendar only).
- The buddy shows the next event ("Stand-up in 40 min").
- Before starting a work block or focus mode, if an event starts during the
  block, the buddy offers to shorten the block to end before it, or start
  anyway.
- A gentle heads-up a few minutes before an event starts during focus mode.
- Event data is used in memory and cached locally only. Nothing is written
  to the calendar in the MVP.
- **OAuth:** `chrome.identity.launchWebAuthFlow`, not `getAuthToken`, because
  `getAuthToken` only works in Google Chrome and the launch targets every
  Chromium browser (§5).

### 4.7 Settings (minimal)

Timer lengths, focus nudge interval, blocklist, calendar
connect/disconnect, buddy visibility (position, hidden sites, hide
everywhere), the keyboard shortcut (managed by the browser's own shortcuts
page), and sign out. Nothing else.

### 4.8 Accounts and data

- **Sign-in is required.** The extension does nothing until the user signs
  in with their Plover account (Supabase auth, waitlist-gated). This keeps
  the launch waitlist-only and protects the Gemini proxy.
- **Settings sync, tasks stay local.** Settings (blocklist, timer lengths,
  buddy position and visibility) live in `chrome.storage.sync`, so they
  follow the user across their signed-in browsers. `storage.sync` is capped
  at about 100 KB total and 8 KB per item, so tasks, steps and session
  history live in `chrome.storage.local` on this device only.
- No user data goes to Plover's servers. `plover-server` only sees the task
  text sent for step suggestions; Supabase only holds the account.
- Uninstalling the extension deletes local data. (Export is not in the MVP.)

## 5. Scope

### MVP (waitlist launch)

- Floating buddy on every page plus toolbar popup, with an animation-state
  interface (placeholder art until the design lands)
- Task breakdown with AI-suggested, fully editable steps
- Pomodoro timer with one self-reported check-in per work block
- Site/tab blocking built into the extension
- Focus mode tying timer + blocking + quiet buddy together
- Read-only Google Calendar integration
- Required sign-in; minimal settings

**Browsers:** all Chromium browsers (Chrome, Edge, Brave, Arc). Distributed
as an unlisted Chrome Web Store listing for the waitlist (needs a privacy
policy and store review). Edge users can install from the Chrome Web Store;
a separate Edge Add-ons listing is optional.

### After the MVP (not committed, in rough order of interest)

- Gamification: streaks that never punish, buddy reactions and unlocks,
  session history and stats
- Smarter nudges and check-ins ("stuck? want me to split this step?"),
  including the stall nudge cut in rev. 2026-10-19
- Writing focus blocks to the calendar
- Firefox and Safari versions
- Making the Web Store listing public

### Explicit non-goals for the MVP

- No desktop app. The Electron app is frozen (§6).
- No AI progress tracking, inference, progress percentages or goal bars.
- No stall nudge (dropped in rev. 2026-10-19).
- No reading page content, browsing history or screen capture. The content
  script draws the buddy and reads nothing from the page.
- No auto-scheduling into working-hours windows.
- No Gmail, Drive, Docs, Classroom or GitHub connectors.
- No blocking or changes outside the browser.
- No voice input, no mobile app, no team features.

## 6. What carries over from the Electron app

The Electron app in `app/` was **deleted on 2026-10-26**; pure logic was
ported into `extension/`. The table below is kept as history: the Fate
column records the decision made at the pivot, not the current state.

| Area                                                   | Fate at pivot              | Notes                                                                                                                                                          |
| ------------------------------------------------------ | -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Pomodoro state machine (`app/src/main/timer/`)         | **Port**                   | Pure and clock-injected, so it moves into the extension's background worker. The ticking `TimerService` doesn't port: MV3 needs alarms plus timestamps (§4.3). |
| Step suggestions (`app/src/main/planner/decompose.ts`) | **Port the request**       | The extension calls the same `plover-server` endpoint directly.                                                                                                |
| Gemini proxy (`plover-server`) and Supabase auth       | **Keep**                   | Unchanged. The extension signs in with Supabase and sends the session token to `plover-server`.                                                                |
| Google OAuth (`google-auth.ts`) + `CalendarSource`     | **Re-do in the extension** | Same scope and behaviour, rebuilt on `chrome.identity` and `fetch`.                                                                                            |
| Store (SQLite + typed repos)                           | **Freeze**                 | Replaced by `chrome.storage` (§4.8).                                                                                                                           |
| Companion window, renderer views, onboarding           | **Freeze**                 | Replaced by the floating buddy, popup and options page. React components may be copied over where useful.                                                      |
| Timer IPC, sessions migration, stall nudge engine      | **Freeze**                 | Built for the desktop app before rev. 2026-10-19.                                                                                                              |
| Activity monitoring, inference, connectors, scheduler  | **Freeze**                 | As before.                                                                                                                                                     |

"Freeze" meant: don't extend it and don't let new code depend on it. The
whole app, including the frozen rows, was removed on 2026-10-26; it remains
in git history.

Extension architecture (MV3):

- **Background service worker:** owns timer, focus and blocking state,
  alarms, `declarativeNetRequest` rules, calendar fetches and calls to
  `plover-server`. The source of truth for all state.
- **Content script:** draws the buddy in a Shadow DOM root and relays
  clicks to the worker. Holds no state of its own.
- **Popup and options page:** extension pages that read and change state
  through the worker.
- **Blocked page:** an extension page that blocked requests redirect to.
- **Permissions:** `storage`, `alarms`, `declarativeNetRequest`, `identity`,
  `notifications`, plus host access to all sites for the floating buddy
  (see §7).

## 7. Open questions

- **Character and animations**: pending the separate design work.
- **"All sites" permission warning**: a buddy on every page needs host
  access to all sites, which Chrome shows at install as "read and change
  all your data on all websites" and which slows store review. Accept that
  (and explain it on the listing), or start with the popup only and inject
  the buddy only on sites the user opts in to?
- **Blocking strictness**: can the user end a blocked session early with one
  click, or is there a small speed bump (e.g. "type why")? Default proposed:
  one click, no guilt.
- **Signed-out and offline behaviour**: sign-in is required, but what
  happens when the Supabase session expires mid-focus-session or the user is
  offline? Proposed: keep running the current session, ask to sign in
  again afterwards.
- **Timer defaults**: Pomodoro 25/5 is the proposed default; offer a 50/10
  "deep work" preset too?
- **Calendar scope**: primary calendar only, or let the user pick calendars?
- **Edge Add-ons listing**: needed for launch, or is the Chrome Web Store
  enough for Edge users?

## 8. Background

- [Progress visibility motivation evidence](../../../reports/Progress%20visibility%20motivation%20evidence.md)
  and its [research notes](../../../research_notes/): the research behind the
  old thesis, including the competitive landscape. Its finding that task
  decomposition, overlays and screen capture are commodities is part of why
  the product is now differentiated by character and feel rather than by
  tracking.
- Companion-productivity research (Finch, Duolingo, Forest, Sprout, Otto)
  from 2026-09-09 concluded the cute-companion niche is mostly mobile-only and
  that nobody owns the desktop moment. The browser is where that desktop
  work happens.
