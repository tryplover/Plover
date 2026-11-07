# MCP - Phase 1 (Google) — Follow-ups

Deferred items from the Phase-1 implementation + final whole-branch review. None
blocked merge; each is a scoped follow-up.

## 1. Connector pagination (correctness)

None of the three connectors handle `nextPageToken` — they read only the first
page of results per poll. The failure mode differs per connector:

- **Gmail** (`history.list`) and **Classroom** (`courses.courseWork.list`): drop
  everything beyond page 1 **and** advance the cursor past it → **silent loss** of
  items in a large delta between polls.
- **Calendar** (`events.list`): `nextSyncToken` is only returned on the *final*
  page. A multi-page delta yields `nextSyncToken === undefined`, and the source
  falls back to the old `syncToken` (`?? cursor`) → next poll re-fetches page 1 →
  **duplicate `calendar_event` rows** (not loss).

Fix: loop on `nextPageToken` (Gmail/Classroom) / page through until `nextSyncToken`
appears (Calendar) before advancing the cursor. Low risk at the 5–30 min cadence,
but real for busy accounts or after a long pause.

## 2. Re-consent path for already-connected users (migration)

Phase 1 expanded `GOOGLE_API_SCOPES` from `drive.metadata.readonly` to the full
Gmail/Drive/Docs/Calendar/Classroom set. An existing user with
`googleConnected = true` consented only to the old scope. On upgrade, the new
source toggles default on, so the Gmail/Calendar/Classroom pollers immediately call
APIs with a token lacking those scopes → **403 on every tick** (caught + logged, so
no crash, but the cursor never seeds and it 403-loops every 5/30 min).

Reconnecting fixes it (`authorize()` forces `prompt: 'consent'`). Fix: detect the
scope upgrade and prompt existing users to reconnect (surfaces naturally once the
Task 11 connect UI lands), or store granted scopes and gate pollers on them.

## 3. Wire the outbound-host allowlist (defense-in-depth)

`assertAllowedHost` (`app/src/main/http/allowlist.ts`) is defined + unit-tested but
not invoked anywhere — provider calls go through the `googleapis` SDK, which bypasses
it. Either wire a runtime host check into the SDK's transport / a shared fetch, or
keep it documented-only (CLAUDE.md wording already corrected to say it is not yet a
runtime gate).

## 4. Task 11 — connect + settings UI (deferred)

Not implemented in Phase 1 (overlaps in-flight renderer WIP; not visually verifiable
in the build environment). Remaining:

- One-click "Connect Google" in `StepConnect` (replace the "coming soon"
  integrations placeholder), calling the existing google-connect IPC.
- Per-source toggles (`gmailEnabled` / `calendarEnabled` / `classroomEnabled`) in the
  Settings page, mirroring the `gdocsPollingEnabled` toggle.

The backend is complete without this: `google:connect` already requests the full
scope set and connecting drives every connector; toggles default on.

## Minor (accepted, non-blocking)

- `gmail-source.ts`: `?? undefined` no-op on header lookup; empty `historyId` on
  first snapshot returns `''` (self-corrects by re-snapshotting next tick).
- `calendar-source.ts`: 410 reseed falls back to the stale cursor if the reseed
  response omits `nextSyncToken` (can 410-loop, never crashes).
- `google-auth.test.ts`: scopes assertion uses `arrayContaining` (won't catch an
  accidentally-added extra scope).
- Subscribers gate only on the per-source flag, not `googleConnected` — harmless
  because only the (connected-gated) poller emits their events.
