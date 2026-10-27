# Chrome Extension MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Plover MV3 browser extension in a new `extension/` workspace package covering every MVP feature in spec §4 (buddy, task breakdown, Pomodoro, blocking, focus mode, calendar, settings, required sign-in).

**Architecture:** The background service worker is the single owner of state. It persists everything to `chrome.storage` (settings → `storage.sync`, everything else → `storage.local`) and drives time with `chrome.alarms` + stored end timestamps. The popup, options page, blocked page and the content-script buddy are thin React views: they read state by subscribing to `chrome.storage.onChanged` and change it only by sending typed `Command` messages to the worker.

**Tech Stack:** WXT (MV3 build, manifest generation, `createShadowRootUi`, `wxt/testing` fake browser), React 18 + react-dom 18 (same major as `app/`), TypeScript strict, Vitest, ESLint flat config, `@supabase/supabase-js` v2.

**Spec:** [docs/superpowers/specs/2026-10-02-desktop-buddy-pivot-spec.md](../superpowers/specs/2026-10-02-desktop-buddy-pivot-spec.md) (rev. 2026-10-19). Read §4, §6 and §7 before starting any task.

## Global Constraints

- Manifest V3 only. Must load in Chrome, Edge, Brave, Arc: never use `chrome.identity.getAuthToken`; use `launchWebAuthFlow`.
- Host access: `<all_urls>` (decided 2026-10-26: buddy on every page, accept the install warning).
- Permissions exactly: `storage`, `alarms`, `declarativeNetRequest`, `identity`, `notifications`, `tabs`. Nothing else.
- Content script reads nothing from the page DOM. It only renders the buddy inside a Shadow DOM root and listens to `fullscreenchange`.
- Never log, store or send visited URLs. Blocking reads a tab URL only to compare it against the blocklist, in memory.
- Never use a ticking counter in the worker. Timer = phase + `phaseEndsAt`; `chrome.alarms` fires transitions; views compute remaining time from the timestamp.
- Settings in `chrome.storage.sync` under one key `settings` (must stay < 8 KB). Tasks, sessions, timer, focus, calendar cache, auth session in `chrome.storage.local`.
- New code must not import from `app/`. Port by copying.
- Gemini only via `plover-server` `POST /api/decompose` with `Authorization: Bearer <supabase access token>`. No-AI fallback: any failure yields an empty, editable step list.
- Calendar scope exactly `https://www.googleapis.com/auth/calendar.readonly`, primary calendar, read-only.
- Env vars (extension/.env, see `.env.example`): `WXT_SUPABASE_URL`, `WXT_SUPABASE_ANON_KEY`, `WXT_PLOVER_BACKEND_URL`, `WXT_GOOGLE_CLIENT_ID`.
- Defaults: work 25, short break 5, long break 15, long break after every 4 work blocks, focus nudge every 15 min, buddy corner `bottom-right`.
- Ending a blocked session early: one click, no speed bump (spec §7 proposed default).
- Supabase session expiry mid-session: keep the running timer/focus session going; show sign-in afterwards (spec §7 proposed default).
- Repo conventions from CLAUDE.md: strict TS incl. `noUncheckedIndexedAccess`, no comments unless WHY is non-obvious, no real network in tests, path-based pnpm filters (`--filter ./extension`).
- Animation-state interface: `'idle' | 'working' | 'break' | 'focus' | 'nudging' | 'celebrating'`. Placeholder art only (a CSS blob whose class is the state). Don't invent character art.

## Review Focus

1. Worker suspended across a phase end (laptop sleep, idle SW): on wake the alarm fires late; exactly one transition must happen and remaining time must come from `phaseEndsAt`, never replay missed phases. → test in Task 2 (`tick` called 3 phases late advances once).
2. User types blocklist entries as URLs (`https://www.YouTube.com/watch?v=1`, `youtube.com/`, ` reddit.com `): expected to normalise to a bare lowercase domain without `www.`; garbage (`not a site`, empty) rejected. → tests in Task 5.
3. A blocked site already open in a tab when focus starts: expected to be redirected too, not only newly opened ones. → test in Task 5.
4. All-day calendar events (date-only `start.date`) must not trigger the "event during your block" offer or heads-up. → test in Task 6.
5. Supabase session expired / 401 while a focus session is running: session keeps going, blocking stays on until it ends, UI shows sign-in. → test in Task 3 (gate) and Task 5 (focus unaffected).

---

## Stack layout

One PR per task, stacked in order, each green on `pnpm typecheck && pnpm lint && pnpm test`. Branches: `ext/01-scaffold`, `ext/02-core-state`, `ext/03-auth`, `ext/04-panel-tasks`, `ext/05-blocking-focus`, `ext/06-calendar`, `ext/07-buddy-options-docs`. See the `restack` and `plover-git-safety` skills (GitHub-native stacked merge).

## File structure

```
extension/
  package.json            name "plover-extension"; scripts dev/build/zip/typecheck/lint/test/test:coverage; postinstall "wxt prepare"
  wxt.config.ts           srcDir 'src', modules ['@wxt-dev/module-react'], manifest (perms, host_permissions, commands)
  tsconfig.json           extends ./.wxt/tsconfig.json + repo strict flags
  eslint.config.js        mirrors app/eslint.config.js rules
  vitest.config.ts        WxtVitest() plugin; coverage gate 60% on src/lib/**
  .env.example
  src/entrypoints/
    background.ts         defineBackground → registers handlers from src/background/
    content/index.tsx     buddy (createShadowRootUi)
    popup/index.html, popup/main.tsx
    options/index.html, options/main.tsx
    blocked/index.html, blocked/main.tsx
  src/lib/                pure / storage-level logic (TDD, coverage-gated)
    types.ts  storage.ts  messages.ts  buddy-state.ts  visibility.ts
    timer/machine.ts  timer/types.ts
    auth/supabase.ts  auth/session.ts  api/decompose.ts
    blocking/domains.ts  blocking/rules.ts
    calendar/events.ts  calendar/client.ts
  src/background/         worker wiring (imperative shell)
    controller.ts  alarms.ts  timer.ts  tasks.ts  auth.ts  blocking.ts  focus.ts  calendar.ts  badge.ts
  src/ui/                 React views shared by popup/buddy/options/blocked
    useExtensionState.ts  Panel.tsx  SignIn.tsx  TaskBreakdown.tsx  TimerControls.tsx  CheckIn.tsx  Buddy.tsx  CalendarNext.tsx
  tests/                  mirrors src/
```

---

### Task 1: Scaffold the `extension/` workspace package

**Files:**
- Create: everything under `extension/` listed above except `src/lib/**`, `src/background/**`, `src/ui/**` (entrypoints are stubs rendering "Plover")
- Modify: `pnpm-workspace.yaml` (add `extension`), root `package.json` scripts + lint-staged, `.github/workflows/ci.yml`, `.gitignore` (`extension/.output`, `extension/.wxt`, `extension/.env`)
- Test: `extension/tests/manifest.test.ts`

**Interfaces:**
- Produces: working `pnpm --filter ./extension {dev,build,typecheck,lint,test}`; root `pnpm typecheck|lint|test` run **both** `./app` and `./extension` (`pnpm --filter ./app --filter ./extension <script>`).

- [ ] **Step 1:** `pnpm --filter ./extension add -D wxt @wxt-dev/module-react vitest @vitest/coverage-v8 typescript eslint @types/react @types/react-dom` and `add react@^18 react-dom@^18`. Pin react/react-dom/@types/react-dom to the same major as `app/` (18). If install hangs on the registry, follow the `plover-pnpm-workspace` skill.
- [ ] **Step 2: Write the failing test** `tests/manifest.test.ts`: import the manifest object exported from `wxt.config.ts` (export it as `const manifest` and pass it in) and assert `manifest.permissions` deep-equals `['storage','alarms','declarativeNetRequest','identity','notifications','tabs']`, `manifest.host_permissions` equals `['<all_urls>']`, and `manifest.commands._execute_action.suggested_key.default === 'Alt+Shift+P'`.
- [ ] **Step 3:** Run `pnpm --filter ./extension test` → FAIL.
- [ ] **Step 4:** Write `wxt.config.ts` (name "Plover", `web_accessible_resources` for `blocked.html` matching `<all_urls>`), tsconfig with strict flags copied from `app/tsconfig.json`, eslint config, vitest config with `WxtVitest()`, stub entrypoints.
- [ ] **Step 5:** Run `pnpm --filter ./extension test && pnpm --filter ./extension build` → PASS; `.output/chrome-mv3/manifest.json` contains the permissions.
- [ ] **Step 6:** Update root scripts, lint-staged (`extension/**/*.{ts,tsx}` same commands with `--filter ./extension`), CI steps (typecheck/lint/test for both; upload `extension/coverage/` too). If `wxt`/`esbuild` postinstall is blocked, add it to `onlyBuiltDependencies`.
- [ ] **Step 7:** Run `pnpm install && pnpm typecheck && pnpm lint && pnpm test` from root → all green. Commit `feat(extension): scaffold WXT MV3 workspace package`.

### Task 2: Core state — types, storage, messages, timer engine

**Files:**
- Create: `src/lib/types.ts`, `src/lib/storage.ts`, `src/lib/messages.ts`, `src/lib/timer/types.ts`, `src/lib/timer/machine.ts`, `src/lib/buddy-state.ts`, `src/background/controller.ts`, `src/background/alarms.ts`, `src/background/timer.ts`, `src/background/badge.ts`, `src/background/tasks.ts`
- Modify: `src/entrypoints/background.ts`
- Test: `tests/lib/timer/machine.test.ts`, `tests/lib/storage.test.ts`, `tests/lib/buddy-state.test.ts`, `tests/background/timer.test.ts`, `tests/background/tasks.test.ts`

**Interfaces (Produces — later tasks rely on these exact names):**
```ts
// lib/timer/types.ts + machine.ts: copy app/src/shared/timer.ts and app/src/main/timer/machine.ts verbatim
//   (TimerState, TimerConfig, TimerEvent, TimerTransition, IDLE_TIMER, startTimer, tick, pauseTimer,
//    resumeTimer, skipPhase, stopTimer, delayPhase, remainingSeconds). Drop TimerSnapshot.
// lib/types.ts
interface Settings { workMinutes: number; shortBreakMinutes: number; longBreakMinutes: number;
  blocksPerLongBreak: number; focusNudgeMinutes: number; blocklist: string[];
  buddyCorner: 'top-left'|'top-right'|'bottom-left'|'bottom-right'; hiddenSites: string[];
  hideEverywhere: boolean }
interface Step { id: string; title: string; done: boolean }
interface Task { id: string; title: string; steps: Step[]; createdAt: number; doneAt: number | null }
interface Session { id: string; taskId: string | null; phase: RunningPhase; startedAt: number; endedAt: number; completed: boolean }
interface FocusState { on: boolean; startedAt: number | null }
interface Transient { checkInPending: boolean; nudgeText: string | null; nudgeUntil: number; celebrateUntil: number }
interface LocalState { tasks: Task[]; activeTaskId: string | null; timer: TimerState; sessions: Session[];
  focus: FocusState; blockingOn: boolean; transient: Transient; needsSignIn: boolean;
  calendar: { events: CalendarEvent[]; fetchedAt: number } ; calendarConnected: boolean }
interface CalendarEvent { id: string; title: string; start: number; end: number; allDay: boolean }
type BuddyAnimationState = 'idle'|'working'|'break'|'focus'|'nudging'|'celebrating'
// lib/storage.ts
const DEFAULT_SETTINGS: Settings; const DEFAULT_LOCAL: LocalState
getSettings(): Promise<Settings>; updateSettings(patch: Partial<Settings>): Promise<Settings>
getLocal<K extends keyof LocalState>(key: K): Promise<LocalState[K]>; setLocal(patch: Partial<LocalState>): Promise<void>
timerConfig(s: Settings): TimerConfig
// lib/messages.ts
type Command =
 | { type: 'timer/start'; endBy?: number } | { type: 'timer/pause' } | { type: 'timer/resume' }
 | { type: 'timer/skip' } | { type: 'timer/stop' }
 | { type: 'checkin/answer'; stepId: string | null }
 | { type: 'task/decompose'; text: string } | { type: 'task/save'; task: Task }
 | { type: 'task/setActive'; taskId: string | null } | { type: 'step/toggle'; taskId: string; stepId: string }
 | { type: 'auth/google' } | { type: 'auth/password'; mode: 'signIn'|'signUp'; email: string; password: string } | { type: 'auth/signOut' }
 | { type: 'focus/set'; on: boolean; endBy?: number } | { type: 'blocking/set'; on: boolean }
 | { type: 'calendar/connect' } | { type: 'calendar/disconnect' }
type CommandResult = { ok: true; data?: unknown } | { ok: false; error: string }
sendCommand(cmd: Command): Promise<CommandResult>   // browser.runtime.sendMessage wrapper
// background/controller.ts
type Handler<T extends Command['type']> = (cmd: Extract<Command,{type:T}>) => Promise<CommandResult>
registerHandler<T>(type: T, h: Handler<T>): void; dispatch(cmd: Command): Promise<CommandResult>
// background/alarms.ts
onAlarm(name: string, fn: () => Promise<void>): void   // single browser.alarms.onAlarm listener routes by name
// lib/buddy-state.ts
deriveBuddyState(s: Pick<LocalState,'timer'|'focus'|'transient'>, nowMs: number): BuddyAnimationState
// background/timer.ts
applyTransition(t: TimerTransition, nowMs: number): Promise<void>  // writes timer, sessions, checkInPending, reschedules alarms; later tasks hook events via onTimerEvent
onTimerEvent(fn: (e: TimerEvent) => Promise<void>): void
```

- [ ] **Step 1: Write failing tests.**
  - `machine.test.ts`: port `app/tests/**/timer/machine*.test.ts` if present; plus `tick 3 phases late advances exactly one phase` (start at t0, call `tick` at t0 + 3×(25+5) min → state.phase `'shortBreak'`, blocksCompleted 1, events length 2).
  - `storage.test.ts` (fakeBrowser, `fakeBrowser.reset()` in beforeEach): `getSettings()` on empty storage equals `DEFAULT_SETTINGS` (values from Global Constraints); `updateSettings({workMinutes: 50})` persists to `storage.sync` key `settings` and keeps other defaults; `JSON.stringify(DEFAULT_SETTINGS).length < 8192`.
  - `buddy-state.test.ts`: celebrateUntil > now → `'celebrating'` (highest priority); nudgeUntil > now → `'nudging'`; focus.on && phase work → `'focus'`; phase work → `'working'`; shortBreak/longBreak → `'break'`; idle → `'idle'`; paused work still `'working'`.
  - `background/timer.test.ts`: dispatch `timer/start` → `storage.local.timer.phase === 'work'` and an alarm named `timer-phase` with `scheduledTime === phaseEndsAt`; firing `timer-phase` alarm after end → phase `shortBreak`, `transient.checkInPending === true`, one `Session` with `completed: true`; `timer/start` with `endBy = now + 10 min` → `phaseEndsAt === endBy`; `timer/pause` clears `timer-phase` alarm and `timer/resume` re-creates it; `timer/stop` clears alarms and records an incomplete session.
  - `tasks.test.ts`: `task/save` upserts by id; `step/toggle` flips `done` and sets `transient.celebrateUntil = now + 3000` when toggled to done; `checkin/answer` with stepId marks the step done and clears `checkInPending`; with `null` only clears it.
- [ ] **Step 2:** Run `pnpm --filter ./extension test` → FAIL.
- [ ] **Step 3:** Implement. Notes: use `browser` from `wxt/browser`. Badge (`badge.ts`): alarm `badge` with `periodInMinutes: 1` while running, text = `String(Math.ceil(remainingSeconds/60))`, cleared when idle. Background entrypoint: `browser.runtime.onMessage` → `dispatch`, return the promise. Check-in notification: on `work-block-completed`, always create notification id `checkin` "Which step did you finish?" (Task 7 adds the buddy-visibility condition).
- [ ] **Step 4:** Run tests → PASS. Root verify. Commit `feat(extension): worker-owned timer, tasks and storage`.

### Task 3: Auth — required Supabase sign-in

**Files:**
- Create: `src/lib/auth/supabase.ts`, `src/lib/auth/session.ts`, `src/background/auth.ts`, `src/ui/SignIn.tsx`
- Modify: `src/background/controller.ts` (gate)
- Test: `tests/lib/auth/session.test.ts`, `tests/background/auth.test.ts`

**Interfaces:**
- Consumes: `registerHandler`, `setLocal`, `LocalState.needsSignIn`.
- Produces: `getSupabase(): SupabaseClient` (storage adapter over `browser.storage.local`, `persistSession: true`, `autoRefreshToken: false`, `detectSessionInUrl: false`, `flowType: 'pkce'`); `getAccessToken(): Promise<string | null>` (calls `auth.getSession()`, which refreshes if expired); `isSignedIn(): Promise<boolean>`; `GATED_COMMANDS: Command['type'][] = ['timer/start','focus/set','blocking/set','task/decompose','task/save','calendar/connect']`.

- [ ] **Step 1: Failing tests.** `session.test.ts`: the storage adapter round-trips `getItem/setItem/removeItem` through `browser.storage.local`. `auth.test.ts` (mock `@supabase/supabase-js` with `vi.hoisted`, mock `browser.identity.launchWebAuthFlow` and `getRedirectURL` → `'https://abc.chromiumapp.org/'`): `auth/google` calls `signInWithOAuth({provider:'google', options:{redirectTo:'https://abc.chromiumapp.org/', skipBrowserRedirect:true}})`, passes `data.url` to `launchWebAuthFlow({url, interactive:true})`, then `exchangeCodeForSession('CODE')` from the returned `...?code=CODE`, and sets `needsSignIn: false`; returned URL without `code` → `{ok:false}`; `auth/password` signIn/signUp map to `signInWithPassword` / `signUp`; signed out + `timer/start` → `{ok:false, error:'not signed in'}` and timer unchanged; signed out + `timer/stop` while running → ok (session keeps going).
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement; gate lives in `dispatch`. `SignIn.tsx`: "Continue with Google" button + email/password form with Sign in / Create account toggle; errors shown inline.
- [ ] **Step 4:** Run → PASS. Root verify. Commit `feat(extension): required Supabase sign-in`.

### Task 4: Panel, popup and task breakdown

**Files:**
- Create: `src/lib/api/decompose.ts`, `src/ui/useExtensionState.ts`, `src/ui/Panel.tsx`, `src/ui/TaskBreakdown.tsx`, `src/ui/TimerControls.tsx`, `src/ui/CheckIn.tsx`
- Modify: `src/background/tasks.ts` (decompose handler), `src/entrypoints/popup/main.tsx`
- Test: `tests/lib/api/decompose.test.ts`, `tests/background/decompose-handler.test.ts`

**Interfaces:**
- Consumes: `getAccessToken`, `sendCommand`, `LocalState`, `Settings`, `remainingSeconds`, `deriveBuddyState`.
- Produces: `suggestSteps(text: string, fetchImpl?: typeof fetch): Promise<string[]>` (POST `${WXT_PLOVER_BACKEND_URL}/api/decompose`, body `{goalText, now: ISO}`, returns trimmed non-empty `subtasks[].title`, max 12); `useExtensionState(): { settings: Settings; local: LocalState; now: number }` (re-renders on `storage.onChanged` and every 1 s for countdown); `<Panel surface: 'popup' | 'buddy' />`.

- [ ] **Step 1: Failing tests.** `decompose.test.ts` (inject `fetchImpl`): sends `Authorization: Bearer TOKEN`; maps `{goal:{title:'x'}, subtasks:[{title:' A '},{title:''},{title:'B'}]}` → `['A','B']`. `decompose-handler.test.ts`: `task/decompose` returns `{ok:true, data:{steps:[...]}}`; when fetch rejects, 500, 429 or malformed JSON → `{ok:true, data:{steps:[], aiFailed:true}}`; 401 → same plus `needsSignIn: true` stored.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement. UI: Panel shows SignIn when not signed in (unless a session is running: then show timer + a "sign in again" banner); otherwise task input → "Suggest steps" / "Write my own" → editable list (edit, reorder up/down, delete, add) → Start (sends `task/save`, `task/setActive`, `timer/start`); timer view with remaining mm:ss, pause/resume/skip/stop, focus switch placeholder (wired in Task 5), CheckIn prompt when `checkInPending` listing unfinished steps + "None yet"; link to options page. No AI progress estimate anywhere.
- [ ] **Step 4:** Run → PASS. Build and load `.output/chrome-mv3` unpacked; popup renders. Root verify. Commit `feat(extension): popup panel with task breakdown`.

### Task 5: Blocking + focus mode

**Files:**
- Create: `src/lib/blocking/domains.ts`, `src/lib/blocking/rules.ts`, `src/background/blocking.ts`, `src/background/focus.ts`, `src/entrypoints/blocked/main.tsx`
- Modify: `src/ui/Panel.tsx` (focus switch), `src/background/timer.ts` hooks
- Test: `tests/lib/blocking/domains.test.ts`, `tests/lib/blocking/rules.test.ts`, `tests/background/focus.test.ts`

**Interfaces:**
- Produces: `normalizeDomain(input: string): string | null`; `isBlockedUrl(url: string, blocklist: string[]): boolean` (domain or any subdomain); `buildRules(blocklist: string[]): chrome.declarativeNetRequest.Rule[]` (ids 1..n, priority 1, `action: {type:'redirect', redirect:{extensionPath:'/blocked.html'}}`, `condition: {requestDomains:[d], resourceTypes:['main_frame']}`); `setBlocking(on: boolean): Promise<void>` (replaces all dynamic rules; when turning on, `tabs.update` every open tab where `isBlockedUrl`, to `blocked.html`); `setFocus(on: boolean, endBy?: number)`.

- [ ] **Step 1: Failing tests.** `domains.test.ts`: `'https://www.YouTube.com/watch?v=1'`→`'youtube.com'`; `'youtube.com/'`→`'youtube.com'`; `' reddit.com '`→`'reddit.com'`; `'m.x.com'`→`'m.x.com'`; `''`,`'not a site'`,`'localhost'`→`null`; `isBlockedUrl('https://music.youtube.com/x',['youtube.com'])` true, `('https://notyoutube.com',['youtube.com'])` false, `('chrome://newtab',[...])` false. `rules.test.ts`: two domains → two rules with ids 1,2 and exact shape above. `focus.test.ts` (stub `browser.declarativeNetRequest.updateDynamicRules` and `getDynamicRules` with `vi.fn`): `focus/set on` → timer running work, `blockingOn: true`, rules installed, `focus.on`, open tab on `youtube.com` redirected, alarm `focus-nudge` with `periodInMinutes: 15`; firing `focus-nudge` during work sets `transient.nudgeText` (`Still on "<current unfinished step>"?`) and `nudgeUntil = now + 60000`; `timer/stop` or `focus/set off` → rules removed, `blockingOn: false`, nudge alarm cleared; a 401/`needsSignIn` during focus leaves blocking on. Blocking also clears when the timer stops for any reason. Manual `blocking/set` on/off works without a timer.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement. Blocked page: calm copy "This one's blocked until your focus block ends.", remaining time, Buddy placeholder (from Task 7; until then a static blob div), one-click "End focus early" → `focus/set off`. Settings blocklist changes while blocking is on re-apply rules (`storage.onChanged` on `settings`).
- [ ] **Step 4:** Run → PASS. Root verify. Commit `feat(extension): site blocking and focus mode`.

### Task 6: Read-only Google Calendar

**Files:**
- Create: `src/lib/calendar/events.ts`, `src/lib/calendar/client.ts`, `src/background/calendar.ts`, `src/ui/CalendarNext.tsx`
- Modify: `src/ui/Panel.tsx` (next event line + conflict offer), `src/background/focus.ts` (heads-up)
- Test: `tests/lib/calendar/events.test.ts`, `tests/lib/calendar/client.test.ts`, `tests/background/calendar.test.ts`

**Interfaces:**
- Produces: `parseEvents(json: unknown): CalendarEvent[]` (validates the Google response at the boundary; skips cancelled; `allDay` when `start.date`); `nextEvent(events, nowMs): CalendarEvent | null` (first non-all-day with `end > now`); `conflictDuring(events, startMs, endMs): CalendarEvent | null` (non-all-day with `start` in `(startMs, endMs)`); `fetchUpcoming(token, nowMs, fetchImpl?)` (GET `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=<now ISO>&timeMax=<now+24h ISO>&singleEvents=true&orderBy=startTime&maxResults=20`); `getCalendarToken(interactive: boolean): Promise<string | null>` via `launchWebAuthFlow` with `https://accounts.google.com/o/oauth2/v2/auth?client_id=WXT_GOOGLE_CLIENT_ID&response_type=token&redirect_uri=<getRedirectURL()>&scope=<calendar.readonly>`; token + `expiresAt` cached in `storage.local` key `googleToken`.

- [ ] **Step 1: Failing tests.** `events.test.ts`: all-day event never returned by `nextEvent` or `conflictDuring`; event starting exactly at `endMs` is not a conflict; cancelled skipped; missing title → `'(no title)'`. `client.test.ts`: request URL/params and `Authorization` header exact. `calendar.test.ts`: `calendar/connect` stores token, sets `calendarConnected`, creates alarm `calendar-refresh` `periodInMinutes: 15`; refresh with expired token calls `launchWebAuthFlow({interactive:false})`, and on failure sets `calendarConnected: false` without throwing; `calendar/disconnect` clears token, cache and alarm; heads-up: during focus, an event starting within 5 min sets `transient.nudgeText` `"<title> starts in 5 min"` via alarm `calendar-headsup`.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement. Panel: next-event line ("Stand-up in 40 min"); before Start / focus on, if `conflictDuring(events, now, now + workMinutes*60000)` → offer "Shorten to end before <title>" (sends `endBy = event.start - 60000`) or "Start anyway".
- [ ] **Step 4:** Run → PASS. Root verify. Commit `feat(extension): read-only Google Calendar`.

### Task 7: Floating buddy, options page, docs

**Files:**
- Create: `src/lib/visibility.ts`, `src/ui/Buddy.tsx`, `src/entrypoints/content/index.tsx`, `src/entrypoints/options/main.tsx`
- Modify: `src/background/timer.ts` (check-in notification only when buddy not visible), `src/entrypoints/blocked/main.tsx` (use `Buddy`), `docs/RUNNING.md`, `CLAUDE.md` (Commands table + workspace layout: `extension/` no longer "planned"), `.claude/skills/plover-pnpm-workspace` or new `plover-extension` skill for any footguns hit
- Test: `tests/lib/visibility.test.ts`, `tests/ui/Buddy.test.tsx` (optional; UI not TDD-gated)

**Interfaces:**
- Produces: `isBuddyVisible(url: string | undefined, settings: Settings): boolean` (false for non-http(s), `hideEverywhere`, or host in `hiddenSites` incl. subdomains); `nearestCorner(x: number, y: number, w: number, h: number): Settings['buddyCorner']`; `<Buddy state: BuddyAnimationState onClick />` rendering `<div className={'plover-buddy plover-buddy--' + state} />`.

- [ ] **Step 1: Failing tests.** `visibility.test.ts`: `chrome://newtab`, `undefined`, `file:///x` → false; `hiddenSites:['figma.com']` hides `https://www.figma.com/file/1`; `hideEverywhere` hides all; `nearestCorner(10,10,1000,800)` → `'top-left'`, `(990,790,1000,800)` → `'bottom-right'`. Timer test: when active tab is a visible page, no `checkin` notification; when `chrome://` → notification created.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement. Content script: `matches: ['<all_urls>']`, `cssInjectionMode: 'ui'`, `createShadowRootUi` with `position: 'overlay'`, mounted only when `isBuddyVisible(location.href, settings)`; re-evaluates on settings change; hides while `document.fullscreenElement`; drag with pointer events, on drop `updateSettings({buddyCorner: nearestCorner(...)})`; click toggles the `<Panel surface='buddy' />`; panel menu has "Hide on this site" (adds `location.hostname` normalised) and "Hide everywhere". Options page: timer lengths, focus nudge interval, blocklist editor (uses `normalizeDomain`, shows rejection inline), hidden sites list, hide everywhere, calendar connect/disconnect, link to `chrome://extensions/shortcuts` (copy text; can't be opened as a link), sign out.
- [ ] **Step 4:** Docs: `docs/RUNNING.md` new "Extension" section: `.env` vars, `pnpm --filter ./extension dev`, loading unpacked from `extension/.output/chrome-mv3`, adding `https://<extension-id>.chromiumapp.org/` to Supabase Auth redirect URLs and to the Google OAuth web client's authorised redirect URIs, pinning the dev ID with a manifest `key`.
- [ ] **Step 5:** Root verify `pnpm typecheck && pnpm lint && pnpm test`, plus `pnpm --filter ./extension build`. Commit `feat(extension): floating buddy, options page and docs`.

---

## Out of scope (spec §5 non-goals)

Stall nudge, gamification/stats UI, 50/10 preset, multi-calendar, Edge Add-ons listing, Firefox/Safari, deleting `app/`, any change to `plover-server`.
