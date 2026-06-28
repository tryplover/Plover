# Feature: Google Drive / Docs / Sheets write-back (stub)

> Read [../overview.md](../overview.md) first.
>
> **Status:** stub. Expand to a detailed spec before writing its plan.

Extend the existing Google integration (Phase 1 = Calendar OAuth + Drive metadata reads) so Plover can:

- **read** Google Docs / Sheets content (not just file lists) as decomposition context,
- **write** a goal summary into a Drive doc when the user asks (e.g. "save this plan as a Doc in /Plover Plans/"),
- **write** task rows into a chosen Sheet (e.g. "track my Q3 OKRs in this spreadsheet"),
- continue logging `gdocs_revision` events into `ActivityRepo` for inference (already implemented in Phase 1).

## Open questions (resolve before plan)

1. **Scope escalation.** Current scopes are `calendar.events` + `drive.metadata.readonly`. Writes require `drive.file` (per-doc) or `drive` (full Drive). Default to `drive.file` and create-only / user-picker access via Google Picker if possible.
2. **Sheets vs. Docs.** Pick one as v1 — Docs is simpler (insert content into a doc). Sheets needs schema mapping like Notion.
3. **Doc structure.** When writing a "goal summary" doc, what's the template? Suggest: heading = goal title, body = subtasks as a checklist, footer = deadline + calendar link.
4. **File location.** User picks a Drive folder once in Settings; new files go there.

## Sketch of module additions

- `app/src/main/sync/drive.ts` — Drive/Docs/Sheets API surface (read + write).
- Extend `app/src/main/sync/google-auth.ts` to add scopes on consent.
- Settings UI: scope upgrade flow (only re-prompt OAuth when the user enables write-back).

## Hard constraints

- Allowlist additions: `docs.googleapis.com`, `sheets.googleapis.com` (Drive endpoints already allowlisted).
- Reuse the existing Google OAuth client — do not add a second OAuth provider for Google.
- Scope escalation is opt-in: the existing Calendar-only consent stays intact until the user enables write-back.

## Out of scope for this feature

- Real-time collaborative editing.
- Slides write-back.
- Drive Search beyond folder-scoped queries (lives in unified-search).
