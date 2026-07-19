# Remove Google Calendar sync

Rip out the Google Calendar integration entirely. Goals + subtasks become local-only. Keep Google Docs polling + Google OAuth (only the Calendar scope goes away). Also collapse the setup wizard to two steps (Name → Breakdown → commit locally).

## Non-goals

- Do NOT drop the `tasks.calendar_event_id` DB column — existing installs would need a new migration. Just stop reading/writing it.
- Do NOT touch Google Docs polling in `sync/*` or the `gdocs.*` events.
- Do NOT touch `scheduled_start`/`scheduled_end` fields — they're used by the planner + Today view even without Calendar.
- Do NOT update phase-2 spec docs.

## File-by-file surgery

### Wave 1: main-process + shared types (blocking, single agent)

- `app/src/main/sync/calendar.ts` — **delete file** (172 lines: `GoogleCalendarSync`, `patchEventTitleForTask`, `deleteEventForTask`, `handleGoogleError`).
- `app/src/main/planner/deviation-detector.ts` — **delete file** (236 lines: exists only to shuffle calendar events on missed blocks).
- `app/src/main/sync/google-auth.ts:16` — remove `'https://www.googleapis.com/auth/calendar.events'` from `GOOGLE_API_SCOPES`. Keep `drive.metadata.readonly` and any other non-Calendar scopes.
- `app/src/main/planner/schedule.ts` — drop `calendarEvents: CalendarEvent[]` field on input; drop `CalendarEvent` import (line 1); drop `parsedCalendarEvents` and the overlap-detection block (lines ~31, 76–81, 165–171). `scheduleTasks` still produces `scheduled_start`/`scheduled_end`, just without a calendar-collision filter.
- `app/src/main/planner/goal-manager.ts` — drop `GoogleCalendarSync` import (line 5); remove the `calendarSync` param from `saveGoalAndTasks`/`deleteGoalAndTasks`/`startEventForwarding`; drop the Calendar create/delete calls at lines ~18, 22, 71–87, 96, 101–124, 162–165; drop the `calendar.synced` event emissions.
- `app/src/main/planner/decompose.ts:23` — remove `'calendar_event_id'` from the `Omit` union.
- `app/src/main/store/repos/tasks.ts` — remove every `calendar_event_id` from SELECT column lists, INSERT column/value lists, UPDATE assignment maps, and row-mapper objects (lines 22, 28, 35, 43, 55, 61, 67, 98, 113, 133, 153, 170, 185, 206, 221, 251, 269, 284, 301, 316). The DB column itself stays.
- `app/src/main/ipc.ts` — remove `CalendarEvent` import + `GoogleCalendarSync`/`patchEventTitleForTask`/`deleteEventForTask` imports; delete the `calendarSync` export (line 31); delete the `calendar:connect` + `calendar:disconnect` handlers (rename these to `google:connect`/`google:disconnect` since the OAuth entry point is still needed for Docs); drop `calendarSync` arg from `deleteGoalAndTasks` (line 73); drop the `patchEventTitleForTask` call inside `tasks:update` (117–126) and the `deleteEventForTask` call inside `tasks:delete` (131–139); drop `calendarEvents` param on `tasks:schedule` handler + the `calendar_event_id` Omit key; drop `calendar_event_id` Omit key on `goals:save`; drop the `CalendarEvent[]` var and calendar list block from `goal:propose` (~315–325); drop the `calendarEvents` arg to `scheduleTasks` (~329); drop `calendarSync` arg to `saveGoalAndTasks` on `goal:commit`.
- `app/src/main/index.ts` — drop `calendarSync` from the import list (line 4); delete the `DeviationDetector` construction block (222–230) since the detector file is gone.
- `app/src/preload/index.ts` — drop `CalendarEvent` import (line 2); remove `'calendar_event_id'` from Omit unions (59, 73, 91); drop `calendarEvents` param on `scheduleTasks` (line 76); rename `connectCalendar`/`disconnectCalendar` type decls (145–147) and IPC bridges (205–206) to `connectGoogle`/`disconnectGoogle` targeting `google:connect`/`google:disconnect`.
- `app/src/shared/types.ts` — drop `calendar_event_id?: string` from `Task` (line 22); delete the `CalendarEvent` interface (29–34).
- `app/src/shared/events.ts` — drop `'calendar.synced'` from `EventPayloads` (line 24), `AppEvent` union (line 37), and `AppEventMap` (line 46).

### Wave 2a: renderer (depends on Wave 1 types)

- `app/src/renderer/global.d.ts` — mirror the preload changes: drop `CalendarEvent`/`calendar_event_id`/`calendarEvents` on window.api (lines 18, 31, 33, 48, 98–99), rename `connectCalendar`/`disconnectCalendar` → `connectGoogle`/`disconnectGoogle`.
- `app/src/renderer/hooks/useAppEvents.ts:3` — drop `'calendar.synced'` from `DEFAULT_EVENTS`.
- `app/src/renderer/overlay/SetupFlow.tsx` — collapse to two steps. `type Step = 'name' | 'breakdown' | 'committed';` Remove the StepConnect import + branch. In StepBreakdown's `onNext={(p) => { … setStep('connect') }}`, replace with a direct commit: call `window.api.commitGoal(p)` (or whatever the current commit IPC is — inspect `preload/index.ts`), then `setStep('committed')` + `setTimeout(close, 800)`. Update `<Stepper current=…>` calls to only pass 1 or 2. Change `<Stepper>` step labels if it hardcodes three.
- `app/src/renderer/overlay/steps/Stepper.tsx` (+ css) — reduce from 3 labels ("1 Name  2 Breakdown  3 Connect") to 2 ("1 Name  2 Breakdown"). If the stepper is data-driven, change its labels array; if hardcoded, delete the third `<span>`.
- `app/src/renderer/overlay/steps/StepConnect.tsx` + `StepConnect.css` — **delete both files** (no longer referenced).
- `app/src/renderer/main/pages/Settings.tsx` — replace the Calendar-specific card (lines 34, 47, 134, 151–167, 268–315) with a single "Google account" card that Connects/Disconnects via the renamed `connectGoogle`/`disconnectGoogle`. Copy: "Connect Google to enable Docs progress tracking." Keep the oauth-badge component.
- `app/src/renderer/overlay/QuickAdd.tsx` — drop `isGCalSyncEnabled` state (line 19) and the settings-load effect (39–46); drop the empty `calendarEvents: []` arg on `handleSchedule` (150–186); drop the `isGCalSyncEnabled` prop passed to `Step1GoalSetup` (162).
- `app/src/renderer/overlay/components/Step1GoalSetup.tsx` — drop `isGCalSyncEnabled` prop (9–10, 20–21) and the "Sync with Google Calendar" checkbox row (80–98).
- `app/src/renderer/overlay/components/Step2TaskBreakdown.tsx` — rename "Schedule on Calendar" button label (35–46) to just "Schedule" (still valid — scheduler assigns `scheduled_start`/`scheduled_end` locally).
- `app/src/renderer/main/pages/GoalsList.tsx:106` — update confirm-delete body: remove "…and any scheduled calendar events" tail.

### Wave 2b: tests (depends on Wave 1)

- `app/tests/sync/sync-calendar.test.ts` — split. Extract the `GoogleAuth` describe block (lines 1–180) into new `app/tests/sync/google-auth.test.ts`. Delete the file (both blocks).
- `app/tests/sync/calendar-patch.test.ts` — **delete file**.
- `app/tests/planner/deviation-detector.test.ts` — **delete file**.
- `app/tests/planner/planner-schedule.test.ts` — drop `CalendarEvent` import (line 3) and every `calendarEvents:` field (24, 29, 51–94, 119, 165, 185, 206, 220, 230, 243, 258, 272). Delete the "skips windows occupied by existing calendar events" test (51–94).
- `app/tests/main/ipc.test.ts` — drop `calendarSync` import + `vi.mock('../../src/main/sync/calendar')` (2, 13–14); delete `goal:commit calendar sync ordering` describe (127–172); delete calendar-patch tests inside `tasks:update` (309, 340–374); delete the "does not touch calendar" reorder test (392).
- `app/tests/ipc.test.ts:64-65` — delete the `calendar.synced`/`calendar:synced` forwarding test cases.
- `app/tests/bus.test.ts:68-94` — delete the `'calendar.synced'` listener/emit test cases.
- `app/tests/store/store.test.ts:150,161` — drop the `calendar_event_id: 'gcal-id-123'` fixture value + the assertion on it.
- `app/tests/store/summaries-repo.test.ts:21` — drop `calendar_event_id: undefined` from the task fixture.

### Wave 3: docs (orchestrator writes these directly)

- `CLAUDE.md` — swap "turns vague goals into a calendar and shepherds…" tagline; drop Calendar from Phase 1 in-scope list; drop `www.googleapis.com` Calendar host from allowlist bullet if it's Calendar-specific (Docs uses the same host — keep).
- `AGENTS.md:12` — same tagline swap.
- `docs/RUNNING.md` — delete the entire "Google Calendar OAuth (for the app, not signup)" section + related troubleshooting rows.
- Phase 1 spec (`docs/superpowers/specs/phase-1/core-architecture.md`, `store-layer.md`, product spec) — leave a short deprecation note at the top: "As of 2026-07-18, Calendar sync is removed; Sync module is Docs-polling only." Don't rewrite the spec body.
- `docs/superpowers/specs/phase-2/*` — leave untouched.

## Verification (orchestrator, after all waves)

```bash
export PATH=/Users/liyu.xiao/Library/pnpm:$PATH
cd /Users/liyu.xiao/Documents/GitHub/BuildWithGeminiHackathon
pnpm typecheck && pnpm lint && pnpm test
```

All three must be green. If tests reference removed calendar behavior anywhere the recon missed, fix in place (they're small).

Manual smoke: relaunch `pnpm dev`, open setup overlay, verify Name → Breakdown → "Looks right" commits the goal and closes the overlay without a Connect step.
