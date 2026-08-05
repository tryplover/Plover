# Bet 1 — MCP Integrations

**One-click context sources that feed the agent richer signal.**

"MCP" is the epic/ticket name. Architecturally these are not the literal Model
Context Protocol wire protocol — they are first-party **connectors**: endpoints and
data sources that pull the user's real work (email, docs, code, notes) into
Plover's activity stream so the Planner, Inference, and Nudge modules produce
better output.

We chose first-party connectors over hosted MCP servers because the core behavior
we want — *"only new diffs since the last snapshot"* — is stateful, scheduled
incremental ingestion. That is exactly what today's `gdocs-poller.ts` does and what
hosted MCP tool-call servers do **not** give us for free.

## Provider sub-phases

Each provider ships end-to-end (OAuth → snapshot-diff → activity → agent context)
before the next begins. Subtasks are labeled per the ticket.

| Sub-phase | Provider | What it adds | Spec |
|-----------|----------|--------------|------|
| **MCP - Phase 1** | Google | One-click connect **everything**: Gmail, Drive/Docs, Calendar, Classroom | [phase-1-google.md](./phase-1-google.md) |
| **MCP - Phase 2** | GitHub | New diffs since snapshot: commits, PRs, reviews + comments | [phase-2-github.md](./phase-2-github.md) |
| **MCP - Phase 3** | Notion | New diffs since snapshot: edited pages, DB rows, comments/mentions (user picks what to watch) | [phase-3-notion.md](./phase-3-notion.md) |

This bet supersedes the Phase 2 integration stubs (`features/github-integration.md`,
`features/notion-integration.md`, `features/drive-writeback.md`) for the *read/context*
direction. Write-back (creating issues, DB rows, docs) remains out of scope here and
stays a future concern.

## Architecture

Everything lives in / extends the **`Sync` module** — the only module allowed to
talk to external provider APIs — and follows the existing
`sync/google-auth.ts` + `sync/gdocs-poller.ts` shape, one connector per provider:

```
Provider OAuth (keytar)                      per-provider, user's own token
      │
      ▼
Connector poller (sync/<provider>-*.ts)      scheduled, gated on settings toggle
      │  fetch changes since cursor
      ▼
Snapshot/cursor store (sync_cursors table)   minimal state, NOT full content
      │  compute diff, dedupe
      ▼
Typed event on the in-process bus            e.g. gmail.message, github.pr
      │
      ▼
Activity subscriber → ActivityRepo           new activity kinds + zod schemas
      │
      ▼
Inference / Planner / Nudge                  read activity → better output
```

No module imports another's internals. Connectors write to `Activity` only, per the
load-bearing boundaries in the Phase 1 core architecture.

## Snapshot / diff mechanism (the core novel bit)

We **do not persist whole content snapshots** ("new diffs, not whole images"). We
persist a minimal **cursor per source** and emit only what changed since it.

New table (migration in `app/src/main/store/db.ts`):

```sql
CREATE TABLE sync_cursors (
  provider   TEXT NOT NULL,          -- 'google' | 'github' | 'notion'
  source     TEXT NOT NULL,          -- 'gmail' | 'drive' | 'calendar' | 'classroom' | 'commits' | 'prs' | ...
  cursor     TEXT NOT NULL,          -- opaque per-source watermark (historyId, syncToken, ETag, ISO ts, page cursor)
  updated_at TEXT NOT NULL,
  PRIMARY KEY (provider, source)
);
```

Each poll cycle, per source:

1. Read `cursor` (absent ⇒ this is the first snapshot: record the current cursor and
   emit **nothing**, so we never flood the agent with pre-existing history).
2. Fetch changes since `cursor` from the provider API.
3. Dedupe against already-seen ids, emit each new item as an `activity` row.
4. Advance `cursor` and bump `updated_at`.

Per-source cursor types are defined in each provider spec (Gmail `historyId`,
Calendar `syncToken`, Drive `modifiedTime`, GitHub `since`/search `updated:>`,
Notion `last_edited_time` + pagination cursor).

## Shared data model

- **`sync_cursors`** — above.
- **`activity` kinds** — each provider spec lists the exact `kind` strings and their
  zod schemas (added to `app/src/main/store/repos/activity-types.ts`). Content stored
  in the JSON payload is the minimal diff (ids, titles, timestamps, snippets), not
  full bodies.
- **`settings`** — per-provider `<provider>Connected` flag + `<source>Enabled`
  toggle, following the existing `googleConnected` / `gdocsPollingEnabled` pattern in
  `app/src/main/store/repos/settings.ts`. Default off for anything requiring a new
  scope or new provider.

## Constraint reconciliation

- **Local-only data / tokens.** Cursors + diff payloads in SQLite; every provider
  OAuth token in `keytar`, never in SQLite (matches Phase 2 acceptance criteria).
- **Backend proxy stays Gemini-only.** Provider APIs are called directly from the
  connector using the user's OAuth token, exactly as Google is today. We do **not**
  route provider traffic through `plover-server`.
- **Outbound allowlist additions** (must be reflected in code if/when the allowlist
  is enforced, and in `CLAUDE.md`):
  `gmail.googleapis.com`, `www.googleapis.com` (Drive/Docs), `calendar.googleapis.com`,
  `classroom.googleapis.com`, `api.github.com`, `api.notion.com`.
  Note: the allowlist is currently **documented but not enforced in code**
  (no runtime host check exists). Enforcing it is tracked as a shared subtask below.
- **Google restricted-scope verification.** Gmail and Classroom are Google
  *restricted* scopes; Calendar is *sensitive*. Production use requires Google's app
  verification (OAuth consent screen review + possibly a security assessment). In dev
  this works via the "unverified app" consent screen. Flagged in MCP - Phase 1.
- **Privacy.** Diff content is stored locally. It only leaves the device via the
  existing consented Inference/Vision path to the Gemini proxy. No new upload
  surface is introduced by this bet.

## Shared subtasks (do once, before or alongside MCP - Phase 1)

- **S1.** `sync_cursors` table + migration + typed repo (`store/repos/sync-cursors.ts`).
- **S2.** A small connector scaffold: a common poll loop (interval, settings gate,
  first-snapshot rule, cursor read/write, event emit) that each provider connector
  reuses — mirroring `gdocs-poller.ts` but parameterized. Keep it minimal; do not
  build a plugin framework (YAGNI).
- **S3.** Runtime outbound-host allowlist check around the HTTP client + updated
  `CLAUDE.md` allowlist (reconciles the currently-unenforced constraint).

## Cross-cutting acceptance criteria (whole bet)

1. First connect of any source emits **no** historical backlog — only diffs after
   the initial snapshot.
2. Every provider OAuth token is in `keytar`; no token lands in SQLite.
3. Every new `activity.kind` has a zod schema and is consumed by Inference.
4. Every new outbound host is named in this bet and (once S3 lands) in the enforced
   allowlist.
5. No real network in tests — `nock` fixtures per provider API.
6. `pnpm typecheck && pnpm lint && pnpm test` is clean after each sub-phase.

## Implementation order

Strict, per the "by provider" decision:

1. Shared subtasks S1–S3.
2. **MCP - Phase 1: Google** — [phase-1-google.md](./phase-1-google.md)
3. **MCP - Phase 2: GitHub** — [phase-2-github.md](./phase-2-github.md)
4. **MCP - Phase 3: Notion** — [phase-3-notion.md](./phase-3-notion.md)
