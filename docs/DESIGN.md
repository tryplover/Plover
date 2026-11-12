# Plover design

**The one design doc for Plover.** Product scope, system architecture, how each feature behaves, and what's planned. It replaces the pivot spec and the per-feature files that used to live in `docs/superpowers/specs/` (deleted 2026-11-07; they're in git history).

**Last updated:** 2026-11-07.

## 0. How to use this doc

- **Before building a feature:** read §1 (scope), §2 (architecture rules) and the section for the feature you're touching. If the feature isn't here, add a short section (or a "Planned" entry in §9) in the same PR as the code.
- **When the design changes, this doc changes in the same PR.** New state, a new message, a new permission or host, a new surface, a change to what the content script receives, or a behaviour change a user would notice: update the matching section. CI enforces this for the load-bearing paths (§8.3).
- **Before calling work done:** review the diff against §2.3 (architecture rules) and §6 (permissions, network, privacy), the same way a reviewer will. The PR template has the checkbox.
- `docs/plans/` holds short-lived implementation plans for agents. A plan is deleted once its work merges; anything worth keeping moves into this doc.

---

## 1. Product

### 1.1 Vision

Plover is a small, cute character that lives in your browser and keeps you company while you work. You tell it what you're about to do; it helps you break the task down, runs a Pomodoro timer, blocks the tabs that pull you away, and keeps an eye on your calendar so a focus block doesn't run into a meeting. It should feel like a work buddy that's alive on the pages you work in, not a dashboard, a planner or a monitor.

**MVP principle: simple, and not reliant on AI.** Timer, blocking and focus work without a model call. AI shows up in one place, suggesting steps during task breakdown, and the user can always write or edit the steps by hand.

**Why an extension.** Most of the target user's work happens in the browser (Docs, Notion, Overleaf, web IDEs). An extension removes the desktop app, the native bridge and the install friction. (The Electron app was deleted on 2026-10-26.)

### 1.2 Target user

A solo knowledge worker or student on long, self-directed tasks (essays, problem sets, drafts, side projects) who struggles to start and to stay on one thing, and works in a Chromium browser. People who find plain timers and to-do lists too cold to stick with, and respond to a character more than a chart (the Finch / Duolingo / Forest audience).

### 1.3 Character and tone

- Minimalist and cute, expressive through clean motion rather than detail. Floats in a corner of every page (bottom-right by default) and never blocks the work.
- Encouraging and non-judgmental: drifting off gets a gentle "still on it?", never guilt, streak resets or punishment.
- Art is designed separately. Engineering builds against the animation-state interface `idle | working | focus | break | nudging | celebrating` (`BuddyAnimationState`), so art drops in without behaviour changes. Current art: the round "corner sitter" bird (`ui/components/Buddy.tsx`).

### 1.4 Launch

An **unlisted** Chrome Web Store listing linked from tryplover.com. Sign-in is required; sign-up is open (the waitlist gate was dropped on 2026-11-05). All Chromium browsers (Chrome, Edge, Brave, Arc); Edge users install from the Chrome Web Store.

### 1.5 Scope

**In the MVP:** the floating buddy and toolbar popup; task breakdown with editable AI-suggested steps; saved tasks; Pomodoro timer with one check-in per block; site blocking; focus mode; read-only Google Calendar; required sign-in; settings; appearance (light/dark/system).

**After launch (not committed):** gamification that never punishes (streaks, buddy reactions, stats); smarter check-ins ("want me to split this step?"); writing focus blocks to the calendar; Firefox and Safari; a public listing.

**Non-goals:** a desktop app; AI progress tracking, percentages or goal bars; the stall nudge (dropped 2026-10-19); reading page content, browsing history or screen capture; auto-scheduling; Gmail/Drive/Docs/Classroom/GitHub connectors; anything outside the browser; voice, mobile, teams; cloud sync of tasks.

---

## 2. System architecture

### 2.1 Contexts

```
                 ┌────────────────────────── Background service worker ───────────────────────────┐
                 │  command queue ─▶ handlers (features/*/worker.ts) ─▶ chrome.storage.local/sync  │
                 │  alarms (timer phase end, nudges, calendar) · DNR rules · content-script reg.   │
                 │  plover-server (step suggestions) · Supabase session · Google Calendar API      │
                 └───────▲───────────────────────▲────────────────────────────▲───────────────────┘
       runtime.sendMessage(Command)     storage.onChanged            Port "plover-state"
                         │              (extension pages)           (BuddySnapshot only)
   ┌─────────────────────┴──────────┐            │                            │
   │ Extension pages (trusted)      │◀───────────┘              ┌─────────────┴──────────────┐
   │ popup · in-page panel (iframe) │                           │ Content script (every page)│
   │ options · welcome · blocked    │                           │ draws the buddy in a closed │
   └────────────────────────────────┘                           │ Shadow DOM; reads nothing   │
                                                                 └────────────────────────────┘
```

| Context | Entry | Does | Never does |
|---|---|---|---|
| **Service worker** | `entrypoints/background.ts` | Owns all state. Runs every mutation through one command queue. Alarms, `declarativeNetRequest` rules, content-script registration, network calls. | Hold state in memory that isn't also in storage (MV3 can suspend it any time). |
| **Content script** | `entrypoints/content/` | Draws the buddy, its speech bubble and the clock; drag to a corner; hide on this site / everywhere; opens the panel iframe. | Read the page, its URL beyond the hostname for "hide on this site", history, or any secret. |
| **Popup** | `entrypoints/popup/` | The full panel (`ui/components/Panel`). Works on every page, including those the content script can't reach. | Write state directly. |
| **In-page panel** | `entrypoints/panel/` | Same `Panel`, in an extension iframe (`panel.html`, `use_dynamic_url`) anchored next to the buddy. Being an extension page, it can read storage. | — |
| **Options** | `entrypoints/options/` | Settings, in its own tab (`open_in_tab: true`). | — |
| **Welcome** | `entrypoints/welcome/` | Opens on install: sign in, site access, calendar, pinning. | — |
| **History** | `entrypoints/task-history/` | Finished tasks with steps and focus time (§4.13). Reads state, changes it only through commands. | — |
| **Blocked** | `entrypoints/blocked/` | Where blocked navigations redirect: calm message, the buddy, the current step. | — |

### 2.2 Data flow

1. **Commands (pages → worker).** Pages call `sendCommand(cmd)` (`shared/messages.ts`); `Command` is a discriminated union and `isCommand` validates it at the boundary. The worker's `dispatch` runs the handler inside `enqueue`, so commands never interleave. Handlers return `{ ok: true } | { ok: false, error }`.
2. **State to extension pages.** Pages read `chrome.storage` directly through `useExtensionState` and re-render on `storage.onChanged`. `storage.local` is set to `TRUSTED_CONTEXTS`, so the content script cannot read it.
3. **State to the content script.** Only through the `plover-state` port (`worker/state-port.ts`), which sends a `BuddySnapshot`: `buddyState`, `nudgeText`, `checkInPending`, and `clock` (`phase`, `phaseEndsAt`, `pausedAt`, or null when idle). No task titles, steps, events or tokens; a test asserts it. The content script reads its own **settings** from `storage.sync` (`useSyncedSettings`): corner, hidden sites, hide everywhere, theme.
4. **Time.** Nothing ticks in the worker. The timer is a phase plus an end timestamp; `chrome.alarms` fires phase changes, and every surface computes time left from the timestamp (the content-script clock ticks locally once a second). `reconcile()` runs on startup and install/update to settle anything that happened while the worker was asleep and to re-register the content script.

### 2.3 Architecture rules (load-bearing)

Breaking any of these defeats the design. Reviewers check them on every PR.

1. **The worker owns all state** and every mutation goes through the single command queue. Nothing else writes state (the only page-side writes are settings via `updateSettings`, which the worker reacts to).
2. **The content script draws only the buddy and reads nothing from the page.** It gets the minimum it needs through the state port. Adding a field to `BuddySnapshot` is a design change: update §2.2 and the state-port test.
3. **Secrets never reach the content script** (Supabase session, Google token). Only the worker and extension pages touch them.
4. **`worker.ts` files and `src/worker/*` are worker-only.** UI and page entrypoints never import them (ESLint `no-restricted-imports`). Pages talk to the worker through `@/shared/messages`.
5. **Pure logic is separate and tested.** `features/<name>/*.ts` (not `worker.ts`) and `shared/` are pure, take `nowMs` instead of reading the clock, and are TDD'd under the coverage gate.
6. **Validate at boundaries only:** user input, messages (`isCommand`), Google and server responses, stored data with defaults. Trust internal calls.

### 2.4 Code layout

```
extension/src/
├── entrypoints/   background.ts, content/, popup/, panel/, options/, welcome/, task-history/, blocked/  (thin)
├── worker/        controller (dispatch), queue (enqueue), alarms, reconcile, state-port
├── features/<name>/   pure logic + worker.ts handlers
│     auth · blocking · buddy · calendar · focus · site-access · tasks · timer
├── shared/        types, storage (defaults, get/set helpers), messages, host, reconnect, theme, links
└── ui/            components (Panel, Buddy, TaskBreakdown, SavedTasks, TimerControls, CheckIn, …),
                   hooks (useExtensionState, useBuddySnapshot), tokens.css, base.css, theme.ts
tests/             mirrors src/
```

---

## 3. State and data

### 3.1 Where data lives

| Store | Holds | Why |
|---|---|---|
| `chrome.storage.sync` → `settings` | `Settings` (below) | Follows the user across their signed-in browsers. Capped at ~100 KB total / 8 KB per item, so settings only. |
| `chrome.storage.local` | `LocalState` (below), the Supabase session, the Google token | Tasks and history stay on this device (hard constraint). 10 MB is plenty: a session is ~150 B, so years of use fit, and `unlimitedStorage` (no install warning) is the fallback if ever needed. |
| `localStorage` of extension pages | `plover-theme` cache | Lets each page paint in the right theme before React mounts. Convenience only. |

No Plover server stores user data. `plover-server` sees only the task text sent for step suggestions; Supabase holds only the account. Uninstalling deletes local data.

### 3.2 Types (`shared/types.ts`)

- **`Settings`:** `workMinutes` 25, `shortBreakMinutes` 5, `longBreakMinutes` 15, `blocksPerLongBreak` 4, `focusNudgeMinutes` 15, `blocklist` [], `buddyCorner` "bottom-right", `hiddenSites` [], `hideEverywhere` false, `theme` "system". `getSettings` spreads `DEFAULT_SETTINGS`, so new keys need no migration.
- **`LocalState`:** `tasks`, `activeTaskId`, `timer` (`TimerState`: `phase`, `phaseEndsAt`, `blocksCompleted`, `pausedAt`), `phaseStartedAt`, `cycleId` (null when idle), `phasePausedMs` (pause time in the current phase), `sessions` (every phase that ran, see below), `focus`, `blockingOn`, `transient`, `needsSignIn`, `calendar` (`events`, `fetchedAt`), `calendarConnected`, `justFiveUntil` (timestamp or null; used by §9.8), `siteBannerDismissedUntil` (0; epoch ms until which the popup all-sites banner stays hidden).
- **`Session`:** `id`, `taskId`, `phase`, `startedAt`, `endedAt`, `completed`, plus optional `cycleId` (default `id`), `pausedMs` (default 0), `taskTitle` (so deleting a task keeps its stats; old sessions show "Untitled task") and `skipped`.
- **Definitions:** a *session* is one timer phase that ran (work, short break or long break). A *cycle* is one sitting, from starting the timer from idle until it goes idle again (Stop, Save for later, Mark task done); its sessions share a `cycleId`. A *Pomodoro* is a completed work session. *Focus time* of a work session is `endedAt - startedAt - pausedMs`.
- **`Task`:** `id`, `title`, `steps` (`{ id, title, done }`), `createdAt`, `doneAt`, optional `parked` (`ParkedTimer`: `remainingMs`, `blocksCompleted`, `parkedAt`) and `lastActiveAt`.
- **`Transient`:** short-lived UI state: `checkInPending`, `checkInTaskId`, `nudgeText`/`nudgeUntil`, `celebrateUntil`, `extendOffer` (used by §9.8).

Optional fields on stored objects are read with defaults; there is no migration layer (no backwards-compat shims for unshipped data).

---

## 4. Features

### 4.1 The buddy (content script)

- Rendered with WXT `createShadowRootUi` (closed shadow root, max z-index) so page CSS can't break it and it can't break the page. Hidden while the page is fullscreen.
- **Drag** to move; it snaps to the nearest corner (`nearestCorner`), saved as `settings.buddyCorner`.
- **Click** toggles the in-page panel (iframe, 320×480, placed next to the buddy's corner) and a small menu: **Hide on this site** (adds the hostname to `hiddenSites`) and **Hide everywhere**. Both are undone in Settings.
- **Speech bubble:** the focus nudge text, or "Which step did you finish?" while a check-in is pending. Clicking opens the panel.
- **Clock:** while a phase runs, the buddy holds a small alarm clock with whole minutes left (seconds in the last minute): green rim for work, amber for breaks, faded when paused, hidden when idle. Purely presentational (`pointer-events: none`).
- **Animation state** comes from `deriveBuddyState` (`features/buddy/buddy-state.ts`): celebrating > nudging (nudge or check-in) > focus/working (work phase) > break > idle.
- Visibility: `isBuddyVisible(url, settings)`; only http(s) pages, not hidden everywhere or on this site.

### 4.2 Site access

Installing asks for **no** site access (no "read and change all your data" warning). Host access to all sites is an **optional** permission (`optional_host_permissions: ["<all_urls>"]`).

1. **Welcome page** (opened on `onInstalled` reason `install`) asks once for all sites from a click (user gesture required).
2. **Runtime registration.** The content script isn't in the manifest; `syncBuddyScript()` registers it with `scripting.registerContentScripts` for the granted origins (`buddyMatches`), on install/update/startup (`reconcile`) and on `permissions.onAdded/onRemoved`, and `injectBuddy` injects it into tabs already open.
3. **Popup banner.** While `<all_urls>` isn't granted, the popup shows "Plover isn't on your pages yet." above the task input with **Show Plover on all sites** (permission request from the click), **Just this site** (the per-site request, only when the current tab can have one) and a **×** that sends `siteAccess/dismissBanner`, hiding the banner for 7 days (`siteBannerDismissedUntil`). The pure `bannerState(granted, dismissedUntil, now)` in `features/site-access/origins.ts` decides. It follows `permissions.onAdded/onRemoved`, so it disappears once access is granted and the worker registers the script.
4. **Per-site fallback.** While the banner is hidden (dismissed) and all sites aren't granted, the popup offers "Show Plover on this site" (exact host). The banner replaces it while showing.
5. **Settings.** The **Where Plover appears** section has a **Show Plover on all sites** switch that requests `<all_urls>` when turned on and removes it when turned off (following `permissions.onAdded/onRemoved`), next to **Hide the buddy everywhere** and **Sites without the buddy**.
6. **Pages no extension can draw on:** `chrome://`, the Web Store, the new-tab page, the PDF viewer, other extensions' pages. The popup is the fallback there.
7. **Blocking and access:** see §4.5.

Chrome's own extension page shows only per-site toggles for optional permissions, so "all sites" can only be granted from inside Plover (the welcome page, the popup banner and Settings).

### 4.3 Task breakdown

1. The user types a task in the popup or panel ("Write the intro of my history essay").
2. **Suggest steps** sends it to `plover-server` `/api/decompose` (Gemini) with the Supabase token. **Write my own** skips AI.
3. Steps are fully editable (edit, reorder, delete, add), then **Start** saves the task (`task/save`), makes it active and starts a work block. Keyboard entry: the popup focuses the title box when it opens idle (unless something else, such as the Undo banner, already holds focus); Enter in the title box runs **Suggest steps**; Enter in a step adds and focuses the next step (nothing if the last step is empty); **Add step** focuses the new step; Ctrl/Cmd+Enter starts.
4. **No flow depends on the model:** on failure or rate limit the user gets an empty list to fill in. Hitting the daily limit (server `429` with `error: "daily rate limit exceeded"`) says so: "You've used today's step suggestions. Write your own below, or try again in about N h." (`limitNotice`); any other failure says "Couldn't suggest steps."
5. Steps are ticked by hand (`step/toggle`). Ticking the last step plays the celebration and sets `doneAt`; the block keeps running until the user stops it (see §9.2 for the planned wrap-up).

### 4.4 Saved tasks

Every task is kept, with its steps and its place in the timer.

- **Idle screen** shows **Your tasks** (open tasks, most recently active first) with steps done, time left in its block and Pomodoro block, **Resume**, and a ⋯ menu (**Mark done**, **Delete** with a 5-second **Undo**). Finished tasks live on the History page (§4.13); the popup and panel show a **History** link once any task is done.
- **While running:** **Save for later** parks the task. **Stop** parks too (stopping never throws time away). **Mark task done** (work and break phases) finishes the task: it sets `doneAt`, stops the timer through `stopAndPark` (which ends focus and blocking, as **Stop** does) and makes the buddy celebrate. Back on the idle screen, a `role="status"` banner `Done: "<title>"` offers **Undo** for 5 seconds (the same banner follows **Mark done** in the ⋯ menu); Undo sends `task/reopen`, which clears `doneAt` and returns the task to **Your tasks** without restarting the timer. The banner is Panel UI state, not worker state.
- **Parking** (`parkedFrom`): a work phase saves its time left (measured at `pausedAt` when paused); under 30 s saves nothing; a break saves a full work block but keeps `blocksCompleted`. An overdue phase is settled first (`settleOverdue`).
- **Resume** (`task/resume`): parks the current task if any, then starts a work block ending at `now + remainingMs` with the saved cycle position. A calendar conflict triggers the same "shorten or start anyway" offer as starting.
- A pending check-in stays tied to its task (`checkInTaskId`) even after switching.
- Commands: `task/park`, `task/resume`, `task/markDone`, `task/reopen`, `task/delete`, `task/clearDone`, all sign-in gated (except park). Pure logic in `features/tasks/parking.ts`.

### 4.5 Pomodoro timer and check-in

- Defaults 25 / 5 / 15, long break after every 4 work blocks; all configurable. Start, pause, resume, skip, stop from the panel or popup.
- **State machine** (`features/timer/machine.ts`, pure): `startTimer`, `tick`, `pauseTimer`, `resumeTimer`, `skipPhase`, `stopTimer`, `delayPhase`, `remainingSeconds`. `startTimer` accepts `endBy` (shortened block) and `blocksCompleted` (resume). Transitions emit events; `bookkeep()` records a session for every running phase that ends (breaks too, with `completed` true only when it ran to `phaseEndsAt`), manages `cycleId` and `phasePausedMs`, and sets the check-in. Skip is told apart by a `reason` the `timer/skip` handler passes (no event distinguishes it). Pause time is added to `phasePausedMs` on resume and excluded from focus time. A phase cut short after under 1 s (e.g. Stop right as a block ends, which settles into a break first) isn't recorded.
- **Alarms** fire at `phaseEndsAt`; nothing ticks.
- **Check-in:** at the end of each work block, "Which step did you finish?" in the panel and the buddy's bubble; answering ticks that step on the task the check-in belongs to. It only appears when the block's task has an open step (`hasOpenStep`, computed in `applyTransition`); an anonymous block or a task with every step done gets none. If no page with the buddy is visible, a system notification carries it.
- **Toolbar badge** shows the minutes left (`features/timer/badge.ts`).
- Keyboard shortcut **Alt+Shift+O** opens the popup (`_execute_action`; users change it at `chrome://extensions/shortcuts`).

### 4.6 Site blocking

- A blocklist of domains in settings. The input is forgiving (`siteFromInput`): "youtube" → youtube.com, `yt`/`fb`/`ig`/`insta`/`x` shorthands, full URLs → their domain.
- While blocking is on (during focus mode, or turned on by hand), `declarativeNetRequest` dynamic rules (`features/blocking/rules.ts`) block those domains. It turns off when the session ends.
- **Redirect vs plain block:** a redirect to the calm blocked page needs host access to the site; without it the rule is a plain block (Chrome's error page). Adding a site in Settings requests access for that domain so it gets the blocked page. That grant doesn't put the buddy on the site (the buddy ignores subdomain-wildcard origins).
- The redirect carries the requested URL in the blocked page's hash (`blocked.html#<url>`, DNR `regexSubstitution`; open tabs get the same when blocking turns on) so the page can name the site and offer to continue after focus ends (#525). `blockedDestination` only accepts http(s). The URL stays in that tab; nothing is stored.
- The extension never records visited sites; it only installs rules. Tabs already open on a blocked site are blocked on their next load.

### 4.7 Focus mode

One switch: starts or resumes the timer on the current task (when the timer is idle and no task is active, it picks up the most recently active open task through `resumeTaskNow`, the same path as `task/resume`, using its parked time and honouring `endBy`; with no open task it starts an anonymous block), turns blocking on for the session, puts the buddy in `focus` (quieter: only the timed "still on it?" nudge every `focusNudgeMinutes`, and the check-in), and warns about a calendar conflict. Turning it off or finishing reverses all of it.

### 4.8 Calendar (optional, read-only)

- Google Calendar, `calendar.readonly`, primary calendar. OAuth with `chrome.identity.launchWebAuthFlow` (implicit token, works in every Chromium browser; `getAuthToken` is Chrome-only).
- Events refresh every 15 minutes (alarm) into `local.calendar`; the panel shows the next event.
- Starting or resuming a block that would overlap an event offers **shorten to end before it** or **start anyway** (`conflictDuring`, `ConflictOffer`).
- During focus, a heads-up 5 minutes before an event.
- Nothing is written to the calendar.

### 4.9 Accounts and auth

- Sign-in is required (Supabase: Google OAuth or email/password; open sign-up). Gated commands (`GATED_COMMANDS` in `features/auth/session.ts`) refuse with a sign-in prompt while `needsSignIn`.
- The sign-in UI (`ui/components/SignIn.tsx`, used by the popup, panel and welcome step 2) leads with **Sign in on tryplover.com**, which opens `/connect` in a new tab (the handoff below). The Google and email/password form sits behind **Or sign in here** as a fallback, collapsed by default.
- The Supabase session lives in `storage.local` (worker and pages only). Calls to `plover-server` send `Authorization: Bearer <access_token>`; the server verifies it with the service-role key.
- **Website handoff.** tryplover.com `/connect` signs the user in on the website, gets a one-time Supabase magic-link token hash from its `extension-handoff` Edge Function (no email is sent) and sends `{ type: "plover/handoff", tokenHash }` to the extension via `runtime.sendMessage`. The worker's `onMessageExternal` listener accepts it only from `https://tryplover.com` (dev builds also `http://localhost:5173`; exact origin match), validates the shape (`features/auth/handoff.ts`: hash is 1-512 chars of `[A-Za-z0-9_-]`) and dispatches `auth/handoff`, which calls `verifyOtp({ token_hash, type: "magiclink" })` to create the extension's own session and clear `needsSignIn`. `auth/handoff` is not gated. `{ type: "plover/ping" }` replies `{ ok, signedIn, version }` so the page can tell "installed" from "not installed or too old". Untrusted senders and malformed messages get no response. The website's tokens are never shared: Supabase rotates refresh tokens and revokes the session on reuse, so two clients cannot hold one session; the hash works once and expires.
- The extension ships only the **publishable** Supabase key. The service-role key and the Google client secret never go in the extension or its build secrets.

### 4.10 Appearance

`settings.theme`: **System** (default) / **Light** / **Dark**. Tokens in `ui/tokens.css` use `light-dark()`, and `:root[data-theme]` pins the scheme. Each page calls `applyStoredTheme()` before mounting (no flash) and `useExtensionState` applies changes live. The content script pins the bubble's scheme the same way inside its shadow root. Light is the cream palette; dark is the forest-green inverse. Both pass WCAG AA.

### 4.11 Settings page

Opens in its own tab. Sections: timer lengths and nudge interval (stepper rows: − value + with a unit; the field can be cleared while typing, and on blur or Enter an empty, zero or invalid value falls back to 1 and anything above the cap is capped: work 90, short break 30, long break 60, blocks 10, nudge 60; `clampInput` in `shared/number-input.ts`), blocklist, buddy (hide everywhere, sites without the buddy), calendar connect/disconnect, appearance, account. Site lists share one aligned row layout with a **Remove** text button. Planned redesign: §9.4.

### 4.12 Welcome page

Opens once on install as a six-step walkthrough, one idea per screen (`entrypoints/welcome/main.tsx` + `steps.tsx`). All copy is in Plover's first-person voice ("I'll sit in the corner of your pages").
1. **Hello**: the buddy waves.
2. **Sign in**: leads with **Sign in on tryplover.com** (opens `/connect`), with the Google/email form behind "Or sign in here". Advances on its own 600 ms after signing in, but only if the user reached this step signed out.
3. **Meet your buddy**: a browser mock; the buddy pops into its corner once all-sites access is granted. A note warns ahead that Chrome's prompt will say "read and change" your sites. "Not now" falls back to per-site access.
4. **Here's how I'll help**: three rows slide in: you tell me what's on your plate, we focus together, I'll check in.
5. **Calendar**: optional, with Skip.
6. **Pin me**: a Chrome-style toolbar mock with the real icon. The buddy flies into the puzzle piece, a mock extensions menu opens, a cursor hovers and clicks the pin, and the icon lands in the toolbar slot with a pulsing ring; then the buddy drops back in. **Show me again** replays it. The step reads `action.getUserSettings().isOnToolbar` and listens to `action.onUserSettingsChanged`: when the user really pins Plover, the buddy celebrates and the step says "You pinned me." "Start my first task" calls `action.openPopup()` and keeps the tab open (closing the tab would close the popup); if that throws, it closes the tab. The privacy line sits under the card.

A six-segment progress bar (the newest segment fills and pops) and a Back button; no jumping ahead, and the step isn't remembered across reloads. The buddy above the card stays mounted: it hops on every step change, blinks (`working`) between steps, and switches to `celebrating` for 1.8 s on the hello step and when sign-in, all-sites access or Calendar succeeds. The card itself doesn't move: it animates its height between steps while the content fades in with a short direction-aware stagger (45 ms per child). Everything is instant under `prefers-reduced-motion`. Focus moves to each step's heading. Only existing tokens are used, so dark mode works.

### 4.13 History page

Opens in a tab from the **History** link in the popup and panel (`browser.tabs.create` on `task-history.html`; no `tabs` permission needed). The entrypoint is named `task-history` because WXT treats an entrypoint named `history` as a `chrome_url_overrides` page, which would replace the browser's own history page.

A vault of everything done, with **Stats** (default) and **Tasks** tabs (`role="tablist"`). The header shows totals over finished tasks.

- **Stats tab** (`features/stats/stats.ts`, pure, from `local.sessions`): a Today / This week (Monday start, the default) / All time switch; tiles for Focus time, Pomodoros, Breaks (short + long) and Cycles, and "N tasks finished"; a pure-CSS last-7-days focus chart (time above each bar, plus a visually-hidden table); and a newest-first cycles timeline, paginated 10 per page (**Previous** / "Page N of M" / **Next**, `paginate`). Each cycle card shows date and time range, counts, task names, a strip of its blocks (width by duration; skipped or cut-short at 50% opacity) and a **Blocks** disclosure listing each block with times.
- **Tasks tab:** day groups (Today, Yesterday, then a date), newest first. Each card shows title, `4 of 4 steps · 3 blocks · 1 h 15 m · 3:42 pm` (`features/tasks/history.ts`; focus excludes paused time), a **Steps** disclosure, **Reopen** (`task/reopen`) and **Delete** (`task/delete`, with a 5-second **Undo** via `task/save`). A search field filters finished tasks by title or step (`vaultSearch`), showing a flat list.
- **Export:** **Download CSV** and **Download JSON** build a `Blob` and click a temporary `<a download>`; no `downloads` permission.
- **Clear history** asks inline, with "Also clear focus stats" (off by default). It sends `task/clearDone`, and `stats/clear` (sign-in gated; sets `sessions: []`) when checked. `task/delete` and `task/clearDone` never touch `sessions`.
- A thin trusted view: reads with `useExtensionState()` and writes only through `sendCommand`. Existing tokens only, so dark mode works.

---

## 5. Visual design

- Source: the Figma file "Plover — Design Package" (`9ArqIcaIijDNziBxmFBgV9`), pages Foundations, Buddy and App MVP (screens: Idle, Break it down, Focus block, Check-in, Break, Calendar heads-up, Blocked site, Settings). It has no onboarding screens.
- Tokens (`ui/tokens.css`): `--color-bg-page|surface|quiet`, `--color-text-primary|secondary|on-brand`, `--color-action-brand-bg|compact-bg|compact-fg`, `--color-border-control|decorative`, `--color-focus`, `--color-status-error`, `--radius-control|card|panel|pill`. Font: Lexend (bundled).
- Components (`ui/base.css`): `.plover-btn-brand`, `.plover-btn-compact`, `.plover-btn-text`, `.plover-chip`, `.plover-eyebrow`, `.plover-heading`, `.plover-toggle`. New UI uses these before inventing new ones.
- Motion respects `prefers-reduced-motion` everywhere (the buddy's animations already do).

---

## 6. Permissions, network and privacy

**Permissions (install time):** `storage`, `alarms`, `activeTab`, `declarativeNetRequest`, `identity`, `notifications`, `scripting`. **Optional:** host access `<all_urls>`. **`externally_connectable`:** `https://tryplover.com/*` only (dev builds add `http://localhost:5173/*`); it is a manifest key, not a permission, so there is no new install warning. Adding or widening any permission is a design change: update this section and justify it for store review.

**Outbound hosts (documented allowlist):** the `plover-server` Cloud Run URL (step suggestions), the project's `*.supabase.co` (auth), `accounts.google.com` (OAuth), `www.googleapis.com` (Calendar). Fonts and assets are bundled. A new host is a design change.

**Privacy rules:** the content script reads nothing from the page; no browsing history; no keystroke content (counts only, if ever); no screenshots uploaded anywhere; tasks never leave the device. Privacy policy: https://tryplover.com/privacy.

---

## 7. Backend: plover-server

A separate repo (`tryplover/plover-server`), Python/FastAPI on Google Cloud Run (project `plover-server-liyuxiao`, us-central1). Endpoint used by the extension: `POST /api/decompose` (Bearer Supabase token) → suggested steps from Gemini. Rate limit: 200 decompose calls per user per day (Firestore counters), `429` with `Retry-After` and `retryAfterSeconds` when exceeded. Deploys on every merge to its `main`: build, deploy a no-traffic `candidate` revision, smoke-test `/health`, promote to 100%, check production, roll back on failure. Deploys change only the image; env vars and secrets are managed in the Cloud Run console. Setup details: `docs/plans/gcp-setup-details.md`.

---

## 8. Build, CI and release

### 8.1 Tooling

pnpm workspace with one package, `extension/` (WXT + React 19, TypeScript strict with `noUncheckedIndexedAccess`). Vitest with WXT's `fakeBrowser`; no real network in tests. Husky pre-commit runs ESLint and Prettier on staged files. Commands are in `CLAUDE.md`.

### 8.2 CI (`.github/workflows/ci.yml`)

Every PR and push to `main`: install → typecheck → lint → test (coverage on PRs; soft 60% gate on `features`, `shared`, `worker`). Each push to `main` also bumps the patch version and publishes the zip as a GitHub pre-release.

### 8.3 Design-doc check (`.github/workflows/design-doc.yml`)

On PRs, if the diff touches a load-bearing path and not `docs/DESIGN.md`, the check fails. Load-bearing paths: `extension/manifest.config.ts`, `extension/wxt.config.ts`, `extension/src/worker/**`, `extension/src/entrypoints/background.ts`, `extension/src/entrypoints/content/**`, `extension/src/shared/types.ts`, `extension/src/shared/messages.ts`, `extension/src/shared/storage.ts`, `extension/src/features/*/worker.ts`. A PR that touches them without changing the design (a refactor or bug fix) adds the label **`no-design-change`** to pass, and says why in the description.

### 8.4 Release

- `release.yml`: a `vX.Y.Z` tag (or manual run) runs the checks, builds the store zip with production `WXT_*` values, verifies the manifest (version matches; no `host_permissions`; no static `content_scripts`), attaches the zip to a GitHub release and, once store credentials exist, uploads and submits it.
- `store-weekly.yml`: every Monday 14:00 UTC, submits the newest pre-release to the Web Store.
- Details and one-time setup: `docs/RELEASING.md`. Running locally: `docs/RUNNING.md`.

### 8.5 End-to-end tests (`.github/workflows/e2e.yml`)

A Playwright suite in `extension/tests/e2e/` drives the built extension in headless Chromium: popup start → pause → skip → Mark task done → Undo; History list, steps and Clear confirm on seeded data; Settings work-block stepper; the buddy drawing on a local page and opening its panel. The fixtures copy `.output/chrome-mv3` to a temp dir and set `host_permissions: ["<all_urls>"]` there so the buddy draws headless; the real build is untouched. Sign-in is faked by writing `needsSignIn: false` and a placeholder `sb-*-auth-token`; no real network (a local HTTP server serves the test page). Screenshots go to `extension/tests/e2e/.screens/` (git-ignored). The workflow runs on pull requests and manual dispatch and uploads the screenshots and Playwright report as artifacts. Locally: `pnpm build && pnpm e2e` (set `PW_CHROMIUM_PATH` to use a specific Chromium). Vitest excludes `tests/e2e/**`.

---

## 9. Planned (designed, not built)

Each entry is the agreed design in brief. Before building one, write a plan in `docs/plans/`, and move the entry into §4 when it ships.

### 9.2 End-of-task wrap-up

Ticking the last open step (or **Mark done**, including the running-screen **Mark task done**) stops the timer, turns off focus and blocking, and shows a wrap-up: "Nice work on '…'. How did that session go?" with **Smooth / Okay / Tough**, an optional one-line note, **Done** or **Skip**. The eyebrow shows blocks and minutes for the task (from `sessions`). Stored as `task.reflection { mood, note, at }`, local only. `transient.wrapUpTaskId` drives the screen; commands `wrapup/answer`, `wrapup/skip`. Unticking within 10 s reopens and resumes. If a check-in answer completes the task, the wrap-up replaces the return to the timer. No stats in v1.

### 9.3 Block sites from the popup

Turning blocking or focus on with an empty blocklist opens an inline editor instead of doing nothing: the current tab's domain (via `activeTab`), suggestions (youtube.com, reddit.com, x.com, instagram.com, tiktok.com, facebook.com), and an add field; blocking turns on at the first add. With sites listed, a chip "3 sites blocked ▾" expands the list. Sites that would get Chrome's plain error page get an **Allow** to request access. Shared `ui/components/BlockList.tsx` replaces the Settings blocklist; pure `suggestedSites`, `currentTabDomain` in `features/blocking/domains.ts`.

### 9.4 Settings page per Figma screen 8

Grouped sections: **Focus** (steppers: work 5–90, breaks 1–30, nudge 5–60), **Blocking** (`BlockList`), **Where Plover appears** (§4.2), **Calendar** (connect; "Warn me before meetings" 5 / 10 / off as `settings.headsUpMinutes`, replacing the fixed 5-minute lead), **Appearance**, **Keyboard shortcut** (shows Alt+Shift+O, links to the shortcuts page), **Account**. Figma settings rows (label left, value right, 51px, divider). Desktop-era rows (Show on desktop, Sounds, 5 more minutes) are left out. Lands after 9.3 so it reuses their components.


### 9.8 "Just 5 minutes" start

Next to **Start** (new task) and **Resume** (saved task), a text button **Just 5 min** starts a normal full work block (`timer/start` or `task/resume` with `justFive: true`) and sets `local.justFiveUntil = now + 5 min` with a one-shot `just-five` alarm. When it fires and the timer is still a running work phase, the worker pauses the timer and sets `transient.extendOffer`; the panel and buddy bubble then ask "Keep going?". **Keep going** (`timer/keepGoing`) clears the offer and resumes, so the block can become a full Pomodoro. **Stop here** (`timer/stopHere`) clears the offer and stops and parks the task: the session is recorded as not completed, so it counts as focus time but not as a Pomodoro. Any transition that leaves the work phase (stop, skip, park, mark done, the block ending) clears `justFiveUntil`, the alarm and `extendOffer` in `applyTransition`. `reconcileTimer` re-creates the alarm when `justFiveUntil` is in the future and applies the pause when it has passed. Worker logic is in place; the buttons and bubble are not built yet.

### 9.9 Next step after a break

When a break ends and a work block starts, the buddy's bubble shows "Next: <first open step>" for 20 s and the running screen scrolls that step into view (it already carries **NOW**). The snapshot gains `nextStep: string | null`; the content script still receives only display text.

### 9.10 Start again from History

Finished tasks in the History Tasks tab get **Start again**: a copy with the same title and steps, all unticked, saved as a new open task (`cloneTask` pure; `task/save`), then "Added to Your tasks." Useful for recurring work.

### 9.11 When you focus best

Stats tab card, shown once there are ≥10 Pomodoros in the last 30 days: a 7 × 24 weekday-by-hour heatmap of focus minutes and one line, "You focus best Tue–Thu, 9–11 am" (the 2-hour window and weekday run with the most focus). Pure `focusHeatmap(sessions, now, days)` and `bestWindow(heatmap)` in `features/stats/`.

### 9.12 Weekly recap

The first time the popup or panel opens in a new week (Monday start) after a week with any sessions, a dismissible card: "Last week: 6 h 10 m focus · 14 Pomodoros · 5 tasks · best day Wed" with **See history**. `local.recapSeenWeek` (week start) stops it repeating. Pure `weeklyRecap(sessions, tasks, weekStart)`.

### 9.13 Plan a focus block from the calendar

With the calendar connected and the timer idle, when the next event is ≥ `workMinutes` away (looking 3 h ahead), the calendar line reads "You're free until 11:00." and **Start** uses that window; when it's shorter, it offers a shortened block that ends 2 min before the event (existing conflict offer). Pure `freeWindow(events, now, horizonMs)` in `features/calendar/`.

### 9.14 Soft weekly goal

Settings: **Weekly goal**, "Focus on N days a week" (default 4, or Off). A day counts with at least one Pomodoro. The idle screen shows "3 of 4 days this week" with seven small dots; it resets Monday and never shows a lost streak. Reaching the goal plays the buddy's celebration once that week (`local.goalCelebratedWeek`). Buddy accessories as rewards wait for real character art.

### 9.15 Optional backup to the user's Google Drive

Settings → **Backup**: "Back up to your Google Drive" stores one `plover-backup.json` (tasks, sessions, settings) in the Drive **app data folder** (hidden, only Plover can read it) using the user's own Google token (`drive.appdata` scope via `launchWebAuthFlow`, like Calendar). Daily alarm plus **Back up now**; **Restore** merges by id. Plover's servers never see it, so "no Plover cloud sync" still holds. Host `www.googleapis.com` is already allowed. **Blocked on the owner:** add the `drive.appdata` scope to the Google OAuth consent screen.

---

## 10. Open questions

- **Blocking strictness:** end a blocked session with one click (current), or a small speed bump?
- **Session expiry mid-focus:** keep running and ask to sign in afterwards (proposed).
- **Timer presets:** add a 50/10 "deep work" preset?
- **Calendar scope:** primary only, or let the user pick calendars?
- **Edge Add-ons listing:** needed, or is the Chrome Web Store enough?
- **Wrap-up (§9.2):** three moods or a 1–5 scale; show past reflections in the Done section; start the next saved task automatically (proposed: no).
- **Saved tasks:** restore focus mode on resume (currently no).

## 11. History

- 2026-05-24: original desktop task-tracker spec (superseded; `docs/archive/`).
- 2026-10-02: pivot to a desktop buddy with five simple features.
- 2026-10-19: Plover becomes a Chromium extension; stall nudge dropped.
- 2026-10-26: Electron app deleted.
- 2026-10-27: site access becomes optional, requested on the welcome page.
- 2026-11-05: waitlist gate dropped; sign-up open.
- 2026-11-07: Figma styling, dark mode, saved tasks, settings in a tab, smarter site input, buddy clock; this doc replaces the pivot spec and per-feature design files; the welcome page becomes a six-step walkthrough.
- 2026-11-08: **Mark task done** on the running screen with Undo (`task/reopen`); History page replaces the popup's Done list.
- 2026-11-10: History page becomes a stats and task vault: every phase is recorded with cycles and pause time; export and `stats/clear`.
- 2026-11-10: end-to-end Playwright suite and `e2e.yml` workflow (§8.5).
- 2026-11-10: focus mode picks up the most recent open task when none is active; the check-in only appears when the block's task has an open step (#529).
- 2026-11-10: the popup banner and a Settings switch grant all-sites access without the welcome page (`siteAccess/dismissBanner`).
- 2026-11-10: keyboard entry in task breakdown: Enter suggests steps, Enter in a step adds the next, Ctrl/Cmd+Enter starts, and the popup focuses the title box (#517).
- 2026-11-11: the in-page panel keeps **Suggest steps** and **Write my own** on one line with 12px between them and the task box, and disabled buttons render at 70% opacity instead of 50% so their text stays above 3:1 contrast (#539).
