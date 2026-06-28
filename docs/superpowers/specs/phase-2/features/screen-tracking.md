# Feature: Screen tracking completion

> Read [../overview.md](../overview.md) first.

Finish the activity-tracking subsystem started in Phase 1: add screenshot capture (opt-in), richer window metadata, a renderer view that displays the activity timeline, and a path for the planner to consume recent activity when decomposing new goals.

## Current state (as of 2026-06-25)

What exists already:

- `app/src/main/activity/window-tracker.ts` — polls `activeWindow()` every 10 s, writes `window_focus` events with `{ app, title }`.
- `app/src/main/activity/gdocs-poller.ts` — polls Drive for modified Google Docs every 10 min, writes `gdocs_revision`.
- `app/src/main/activity/folder-watcher.ts` + `git-commit-tracker.ts` — watch user-selected folders; write `file_modified`, `file_added`, `git_commit`.
- `app/src/main/store/repos/activity.ts` — generic `{ id, ts, kind, payload }` log; `log()`, `listSince()`, `listBetween()`, `list(kind?)`.
- `app/src/main/activity/inference.ts` — uses `/api/infer-progress` on the backend; runs periodically.

What is missing:

- No screenshot capture; no Screen Recording permission flow.
- No browser-URL or bundle-ID metadata on window events.
- No renderer view shows any activity data; the user cannot verify what is being tracked.
- `decomposeGoal` receives only `{ goalText, now, workingHours }` — no recent activity, no goal history.
- No "Activity tracking" group in Settings; toggles for capture vs. polling do not exist.
- No retention controls; activity rows accumulate forever.

## Scope

This feature ships exactly:

1. **Settings: "Activity tracking" panel** — toggles for window tracking, screenshot capture (opt-in, default off), Google Docs polling, file watching. Plus a "Pause all tracking" master switch and a retention setting ("keep N days of activity").
2. **Renderer: Activity timeline view** — a new page that lists `ActivityRepo` rows grouped by day, with per-kind rendering, lazy loading, and a screenshot thumbnail when applicable.
3. **Enhanced window metadata** — `window_focus` events carry `bundleId` (macOS) plus, when the focused app is a known browser (Chrome / Safari / Brave / Arc / Firefox), the active tab `url` and `title`.
4. **Screen Recording permission flow** — when the user toggles screenshots on, the app requests Screen Recording permission via `systemPreferences`; denial is handled gracefully and the toggle reverts.
5. **Screenshot capturer** — when enabled, captures the primary display every 5 minutes (configurable), writes PNG to `app.getPath('userData')/screenshots/YYYY/MM/DD/<uuid>.png`, logs `screenshot_captured` with `{ filePath, width, height }`.
6. **Gemini Vision endpoint on backend** — `POST /api/infer-screen` accepts a base64 screenshot and recent window context, calls Gemini Vision with a structured-output prompt, returns `{ summary, activeApp, currentTask, confidence }`. Renderer toggle "Use Gemini Vision to infer activity" gates calls.
7. **Planner activity context** — `decomposeGoal()` accepts an optional `recentActivity` array. Backend `/api/decompose` accepts the same. When provided, the prompt is augmented with a digest of recent activity so subtasks reflect what the user is already working on.
8. **Privacy controls** — "Delete all activity", "Delete activity older than N days", and a per-row delete in the timeline view.

Out of scope for this feature (deferred):

- Keystroke counts (Accessibility permission).
- Multi-display screenshot capture (primary display only for now).
- Activity-driven nudges (Nudge module stays stubbed in this feature).
- Cross-app DLP / content filtering.

## Module contracts

### `ScreenCapturer` (new — `app/src/main/activity/screen-capturer.ts`)

```ts
export interface ScreenCapturerDeps {
  activityRepo: ActivityRepo;
  settingsRepo: SettingsRepo;
  userDataDir: string;          // app.getPath('userData')
}

export class ScreenCapturer {
  constructor(deps: ScreenCapturerDeps);
  start(): void;                // no-op if setting `screenCaptureEnabled` is false
  stop(): void;
  captureOnce(): Promise<string | null>;   // returns saved file path, or null on no permission / disabled
}
```

Capture interval is `settings.screenCaptureIntervalMinutes` (default `5`, min `1`, max `60`). Capture is skipped when:

- `pauseAllTracking` is true, or
- `screenCaptureEnabled` is false, or
- macOS Screen Recording permission is not `granted`.

PNG files are written under `<userData>/screenshots/YYYY/MM/DD/<uuid>.png`. The full absolute path is logged in the payload; no bytes ever go to SQLite.

### `WindowTracker` (extended)

The existing `WindowTracker` payload becomes:

```ts
type WindowFocusPayload = {
  app: string;
  title: string;
  bundleId?: string;            // macOS only; from get-windows result
  browserUrl?: string;          // when active app is a known browser
  browserTabTitle?: string;     // when active app is a known browser
};
```

Browser-URL capture uses macOS AppleScript via `child_process.execFile('osascript', ...)`. Known browsers: `com.google.Chrome`, `com.apple.Safari`, `com.brave.Browser`, `company.thebrowser.Browser` (Arc), `org.mozilla.firefox`. AppleScript calls have a 1-second timeout; any failure produces an event without the browser fields. Errors are logged once per app-launch session.

**Firefox caveat:** Firefox on macOS does not expose its active tab URL through AppleScript's standard dictionary (unlike Safari and Chromium-based browsers). The AppleScript call will fail and the browser fields will be omitted unless a future implementation switches to a browser-extension or accessibility-API approach.

### Settings additions (`SettingsRepo`)

New keys (all persisted as JSON in the existing `settings` table):

```ts
{
  pauseAllTracking: boolean;                 // default false
  windowTrackingEnabled: boolean;            // default true
  gdocsPollingEnabled: boolean;              // default true (was always on)
  fileWatchingEnabled: boolean;              // default true
  screenCaptureEnabled: boolean;             // default false (opt-in)
  screenCaptureIntervalMinutes: number;      // default 5
  screenVisionInferenceEnabled: boolean;     // default false
  activityRetentionDays: number;             // default 30; 0 = keep forever
  planner_useRecentActivityContext: boolean; // default true once screen tracking is on
}
```

### Activity-timeline IPC (`app/src/main/ipc.ts` additions)

```ts
ipcMain.handle('activity:list', (_, args: {
  since?: string;
  until?: string;
  kinds?: string[];
  limit?: number;
  offset?: number;
}) => ActivityRow[]);

ipcMain.handle('activity:purge', (_, args: { olderThan?: string; ids?: number[] }) => { deleted: number });

ipcMain.handle('activity:getScreenshot', (_, id: number) => { dataUrl: string } | null);

ipcMain.handle('permissions:screenRecording:status', () => 'granted' | 'denied' | 'not-determined' | 'restricted' | 'unsupported');
ipcMain.handle('permissions:screenRecording:request', () => 'granted' | 'denied' | 'unsupported');
```

### `decomposeGoal` (extended)

```ts
export async function decomposeGoal(input: {
  goalText: string;
  now: Date;
  workingHours: { start: string; end: string };
  recentActivity?: Array<{ kind: string; payload: Record<string, unknown>; ts: string }>;
}): Promise<...>;
```

When `recentActivity` is supplied, the backend prompt gains a fixed section:

```
The user has had the following recent computer activity (chronological):
- [ts] kind: <summary>
...
Use this only as soft context — do NOT mention it back to the user, and do NOT force tasks to align with it. If the activity is irrelevant to the goal, ignore it.
```

The renderer is responsible for choosing how much activity to send (default: last 1 hour, capped at 50 entries). The backend rejects requests with `recentActivity.length > 200`.

### Backend: `POST /api/infer-screen` (new)

```ts
// Request
{
  screenshotBase64: string;   // PNG, ≤ 5 MB encoded
  windowContext?: { app: string; title: string; browserUrl?: string };
  authToken?: string;
}

// Response
{
  summary: string;            // 1–2 sentence description of the screen
  activeApp: string;          // best guess at app from the image
  currentTask: string | null; // inferred task or null
  confidence: number;         // 0..1
}
```

Uses Gemini Vision (gemini-2.0-flash with image input) and the same fallback model loop as `/api/decompose`. Returns `400` on missing/oversize image, `502` on all-models-failed.

## Prompt rules — Gemini Vision

- Output is constrained via function calling to the schema above.
- Prompt tells Gemini to never include personally identifiable information from the screen in the `summary` (specifically: no email addresses, no full names except first-name greetings, no monetary amounts, no chat content).
- Confidence ≤ 0.3 means "do not surface to user."

## Tech

- Screenshot capture: Electron `desktopCapturer.getSources({ types: ['screen'], thumbnailSize: { width, height } })` + canvas downscale, or `screen.getPrimaryDisplay()` + `desktopCapturer`. Primary display only.
- Browser-URL capture on macOS: `osascript -e 'tell application "Google Chrome" to get URL of active tab of front window'` (and equivalents per browser). 1-second timeout via `child_process.execFile`.
- Permission status: `systemPreferences.getMediaAccessStatus('screen')` (read-only on macOS — there is no programmatic `ask`; the OS prompt is triggered by the first capture attempt). The Settings flow guides the user to System Settings if the status is `denied`.
- Backend Gemini Vision: existing `@google/generative-ai` SDK accepts `inlineData: { mimeType: 'image/png', data: base64 }` in `parts`.

## Tests

- Unit-test `ScreenCapturer` against a mocked `desktopCapturer` and a temp `userDataDir`. Verify: skip when paused, skip when disabled, skip when permission denied, write to correct dated path, log correct payload.
- Unit-test `WindowTracker` extensions against a mocked `get-windows` + a mocked `execFile` (AppleScript) that returns canned URLs for known browsers and errors for unknown ones.
- Unit-test new IPC handlers with the in-memory SQLite test setup that other repos already use.
- Unit-test the planner's recent-activity prompt assembly with a mocked backend.
- Backend `/api/infer-screen`: unit-test the validation path (oversize image, missing field) and the success path with a mocked Gemini client. No real network in tests.
- Renderer activity-timeline view: smoke-render with React Testing Library; mock IPC to return canned rows.
- No real Gemini Vision calls in tests. Use `nock` or in-memory mocks.

## Acceptance criteria

1. With screenshot capture off (default), zero screenshot files are written, and Screen Recording permission is never requested.
2. Toggling "Capture screenshots" on in Settings prompts macOS Screen Recording on the first capture attempt; if denied, the toggle reverts to off and an inline message in Settings explains how to grant it via System Settings.
3. With capture on at the default 5-minute interval, after 15 minutes there are exactly three `screenshot_captured` rows in `activity` and three PNG files on disk under the dated screenshot directory.
4. The Activity timeline view renders, in reverse chronological order, every event kind currently produced by the system: `window_focus`, `gdocs_revision`, `file_modified`, `file_added`, `git_commit`, `screenshot_captured`, `screenshot_inferred`. Clicking a screenshot row expands it to show the captured image fetched via `activity:getScreenshot`.
4. `window_focus` events emitted while a known browser is the active app include `browserUrl` and `browserTabTitle` in the payload when the AppleScript succeeds; events from unknown browsers and from non-browser apps omit these fields cleanly without throwing.
5. With `planner_useRecentActivityContext` on, calling `decomposeGoal` for the goal *"Finish the design doc I've been working on"* while the user has recent `gdocs_revision` events for a doc titled *"Q3 Plover Roadmap"* produces subtasks that reference the existing document (e.g. "Open Q3 Plover Roadmap doc and finalize introduction section").
6. The "Delete activity older than N days" control removes the correct rows (verified by `ActivityRepo.listSince`) and also deletes the on-disk screenshot files older than N days (orphaned screenshots are pruned).
7. `pnpm typecheck && pnpm lint && pnpm test` clean.

## Privacy guarantees

- No screenshot bytes ever leave the device unless `screenVisionInferenceEnabled` is true.
- The default state for new installs and for users upgrading from Phase 1 is: window tracking ON (already was), screenshots OFF, vision inference OFF.
- Retention default is 30 days; users can shorten it or set 0 (keep forever, opt-in).
- The Activity timeline view doubles as the audit log — every captured event is visible there.
