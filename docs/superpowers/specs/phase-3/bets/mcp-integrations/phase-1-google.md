# MCP - Phase 1: Google (connect everything)

Extend the existing Google connector from "Drive/Docs metadata polling" to a
**one-click connect that covers Gmail, Drive/Docs, Calendar, and Classroom**, each
feeding diffs into the activity stream.

Read [../mcp-integrations/overview.md](./overview.md) first — the connector
architecture, `sync_cursors` table, and constraint reconciliation are defined there
and assumed here.

## Scope

In scope (read/context only):

- **Gmail** — new/unread messages since last snapshot: subject, sender, snippet,
  thread id, labels. No bodies, no attachments.
- **Drive + Docs** — new/modified files and doc revisions (extends today's poller);
  optionally the changed doc's title + revision id, not full body.
- **Calendar** — created/changed/cancelled events on the primary calendar: title,
  start/end, attendees count, location.
- **Classroom** — coursework and due dates for the user's courses.

Out of scope: write-back, Sheets/Slides content, Contacts, sending mail, any content
body upload.

## Auth — one-click, all scopes

Extend `app/src/main/sync/google-auth.ts`:

- Replace the single `drive.metadata.readonly` scope with the full set requested in
  **one** consent so connect is genuinely one click:
  - `https://www.googleapis.com/auth/gmail.readonly` *(restricted)*
  - `https://www.googleapis.com/auth/drive.metadata.readonly` *(existing)* +
    `https://www.googleapis.com/auth/documents.readonly` for revision/title reads
  - `https://www.googleapis.com/auth/calendar.readonly` *(sensitive)*
  - `https://www.googleapis.com/auth/classroom.coursework.me.readonly` and
    `https://www.googleapis.com/auth/classroom.courses.readonly` *(restricted)*
- Keep the existing desktop loopback flow, `access_type: offline`, `prompt: consent`,
  and keytar refresh-token storage (service `plover`, account `google-refresh-token`).
- **Verification flag:** Gmail + Classroom are Google *restricted* scopes and
  Calendar is *sensitive*. Production requires Google OAuth app verification (consent
  screen review, brand verification, possibly a CASA security assessment for
  restricted scopes). Dev proceeds via the unverified-app screen. This is a product/
  ops gate, not a code gate — call it out in the connect UI copy ("Google review
  pending") until verification clears.

## Per-source diff mechanism

| Source | Cursor (`sync_cursors.source`) | Fetch since cursor | First-snapshot behavior |
|--------|-------------------------------|--------------------|-------------------------|
| Gmail | `gmail` → `historyId` | `users.history.list(startHistoryId)`; fall back to `messages.list` bootstrap that only records the latest `historyId` | Record current `historyId`, emit nothing |
| Drive/Docs | `drive` → `modifiedTime` (ISO) | `files.list(q: modifiedTime > cursor ...)` (existing poller query) | Record `now`, emit nothing |
| Calendar | `calendar` → `syncToken` | `events.list(syncToken)`; on `410 GONE` do a full resync that only re-seeds the token | Full list once to obtain the first `syncToken`, emit nothing |
| Classroom | `classroom` → ISO ts | `courses.courseWork.list` + client-side filter on `updateTime`/`dueDate` > cursor | Record `now`, emit nothing |

Each emits a typed bus event; a subscriber writes the `activity` row and advances the
cursor.

## Activity kinds + events

Add to `app/src/main/store/repos/activity-types.ts` (zod schema each) and the event
bus:

| `activity.kind` | Bus event | Payload (minimal) |
|-----------------|-----------|-------------------|
| `gmail_message` | `gmail.message` | `{ id, threadId, from, subject, snippet, labels[], receivedAt }` |
| `gdocs_revision` *(exists)* | `gdocs.revision` | current payload + optional `{ revisionId, title }` |
| `calendar_event` | `calendar.event` | `{ id, title, start, end, status, attendeeCount, location? }` |
| `classroom_coursework` | `classroom.coursework` | `{ courseId, courseName, id, title, dueDate?, state }` |

## Store / settings

- Reuse `sync_cursors` (rows: `google/gmail`, `google/drive`, `google/calendar`,
  `google/classroom`).
- `settings`: keep `googleConnected`; add per-source toggles `gmailEnabled`,
  `calendarEnabled`, `classroomEnabled` (Drive keeps `gdocsPollingEnabled`). Default
  on once connected, except any source still blocked on verification.

## UI

- Replace the "coming soon" Google placeholder in
  `app/src/renderer/overlay/steps/StepConnect/StepConnect.tsx` with a real one-click
  "Connect Google" that triggers the full-scope consent.
- Settings: per-source toggles + last-sync time.

## Subtasks (`MCP - Phase 1`)

1. `MCP - Phase 1` — Expand `google-auth.ts` scopes to the full set; one-click consent.
2. `MCP - Phase 1` — Gmail connector (historyId diff) + `gmail_message` kind/schema/subscriber.
3. `MCP - Phase 1` — Calendar connector (syncToken diff) + `calendar_event` kind/schema/subscriber.
4. `MCP - Phase 1` — Classroom connector (updateTime/dueDate diff) + `classroom_coursework` kind/schema/subscriber.
5. `MCP - Phase 1` — Extend Drive/Docs poller to optionally emit revision id + title.
6. `MCP - Phase 1` — Wire Inference to consume the new kinds (planner/nudge context).
7. `MCP - Phase 1` — Settings toggles + `StepConnect` one-click UI; verification-pending copy.

## Testing

- TDD each connector's diff/cursor logic (first-snapshot rule, dedupe, cursor
  advance, `410 GONE` resync for Calendar). `nock` fixtures per Google API. No real
  network.

## Acceptance

1. One click connects all four surfaces via a single consent.
2. First connect emits no historical backlog; subsequent polls emit only new items.
3. Refresh token in keytar only; cursors in `sync_cursors`.
4. `pnpm typecheck && pnpm lint && pnpm test` clean.
