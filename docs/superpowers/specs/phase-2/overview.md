# Plover — Phase 2 Overview

Phase 2 expands Plover from "type a goal, get it on Calendar" (Phase 1) into a context-aware productivity agent that observes what the user is doing and pulls / pushes work across the tools they already use.

The product motivation lives in the [product spec](../2026-05-24-task-tracker-agent-product-spec.md). [Phase 1 architecture](../phase-1/core-architecture.md) is still authoritative for everything it covers — Phase 2 only adds.

## Phase 2 scope

Phase 2 covers exactly the features below. Each feature has its own subdoc. Implementation order is **strict** — earlier features ship before later ones and do not depend on later work.

1. **Screen tracking completion** — [features/screen-tracking.md](./features/screen-tracking.md) (detailed)
2. **GitHub integration** — [features/github-integration.md](./features/github-integration.md) (stub)
3. **Google Drive write-back + Sheets** — [features/drive-writeback.md](./features/drive-writeback.md) (stub)
4. **Notion integration** — [features/notion-integration.md](./features/notion-integration.md) (stub)
5. **Full-disk file access** — [features/file-access.md](./features/file-access.md) (stub)
6. **Unified search across all sources** — [features/unified-search.md](./features/unified-search.md) (stub)

Each stub will be expanded into a detailed feature spec + plan when its turn comes. Stubs exist now so cross-feature concerns (auth, store layout, search index) are not designed in isolation.

**Still deferred beyond Phase 2:**

- Voice input (`whisper.cpp`)
- Windows / Linux port
- Multi-account, plugins, multi-device sync

## What changes vs. Phase 1

Module boundaries from Phase 1 are preserved. Phase 2 adds new modules under the same rules:

- **New activity producers** (Screen Capturer, GitHub Tracker, Notion Tracker, File Indexer) write to `ActivityRepo` only — they never read other tables.
- **New sync modules** (GitHub Sync, Notion Sync, Drive Sync) talk to their respective APIs and are the only modules that do so.
- **Inference / Nudge** (still stubbed from Phase 1) become live consumers of the richer activity stream — but their first real work lands in this phase, not in screen tracking.
- **Backend proxy** (`server/`) gains endpoints for any API the renderer must not hold credentials for: GitHub OAuth callback, Notion OAuth callback, Gemini Vision for screenshots.

## Hard constraints (Phase 2 deltas)

The Phase 1 constraints still hold. Phase 2 adjusts where the spec explicitly says so:

1. **Local-only data still binds** — SQLite + local filesystem. New integration data lives in new repos under `app/src/main/store/repos/`.
2. **Outbound HTTP allowlist** — extended to add: `api.github.com`, `api.notion.com`, `sheets.googleapis.com`, `docs.googleapis.com`. Every host added to the allowlist must appear in a feature spec; do not add silently. Auth callback hosts (GitHub, Notion) go through the backend proxy and never appear directly in the allowlist.
3. **Permissions on macOS** — Phase 2 introduces three new permission asks, each gated behind an explicit user opt-in:
   - **Screen Recording** — required only when the user enables screenshot capture (see [screen-tracking.md](./features/screen-tracking.md)).
   - **Accessibility** — *not yet requested in Phase 2*. Keystroke counting was scoped out as too expensive for ambient capture. If it returns later, it gets its own feature spec.
   - **Full Disk Access** — required only when the user enables file indexing (see [file-access.md](./features/file-access.md)).
4. **Privacy posture** — never capture keystroke *content*. Screenshots stay local unless the user has explicitly opted in to Gemini Vision inference; the consent surface lives in Settings and the toggle is **default off**.
5. **No third-party productivity-overlay deps** — same as Phase 1.

## Module map (additions)

```
app/src/main/
  activity/
    screen-capturer.ts        # NEW — opt-in screenshot loop
    github-tracker.ts         # NEW — GitHub API polling
    notion-tracker.ts         # NEW — Notion API polling
    file-indexer.ts           # NEW — local FS indexer (when Full Disk Access granted)
  sync/
    github.ts                 # NEW — GitHub write-back (issues, comments)
    notion.ts                 # NEW — Notion write-back (database rows, pages)
    drive.ts                  # NEW — Drive/Docs/Sheets write-back
  store/repos/
    integrations.ts           # NEW — OAuth tokens per provider (encrypted via keytar)
    search-index.ts           # NEW — FTS5 across all sources
  search/
    index.ts                  # NEW — unified search query API
server/src/
  github/                     # NEW — GitHub OAuth callback + API proxy
  notion/                     # NEW — Notion OAuth callback + API proxy
  vision/                     # NEW — Gemini Vision proxy for screenshots
```

## Data model (additions)

```sql
-- New repo: integrations
CREATE TABLE integrations (
  provider TEXT PRIMARY KEY,          -- 'github' | 'notion' | 'google-drive'
  account_id TEXT,                    -- user's id at the provider
  scopes TEXT NOT NULL,               -- JSON array
  connected_at TEXT NOT NULL,
  last_sync_at TEXT
  -- access/refresh tokens live in the OS keychain via keytar, NOT in this row
);

-- New repo: search_index (FTS5 virtual table)
CREATE VIRTUAL TABLE search_index USING fts5(
  source,                             -- 'activity' | 'github' | 'notion' | 'file' | 'drive'
  source_id,                          -- foreign id into the source's table or filesystem
  title,
  body,
  ts,
  unindexed=ts,
  tokenize = 'porter unicode61'
);
```

`activity`, `summaries`, `goals`, `tasks` stay as Phase 1 defined them. New event kinds added to `activity.kind`:

- `screenshot_captured`, `screenshot_inferred`
- `github_pr_opened`, `github_pr_merged`, `github_issue_assigned`, `github_review_requested`
- `notion_page_edited`, `notion_db_row_added`
- `file_indexed`

## Implementation order

Do the steps in this order. Each lands a working sub-feature before the next starts.

1. **Screen tracking completion.** Finish the existing tracking subsystem with screenshot capture (opt-in), advanced window metadata, an activity-timeline UI in the renderer, and planner context plumbing. Detailed in [features/screen-tracking.md](./features/screen-tracking.md). Plan: `docs/plans/2026-06-25-screen-tracking-completion.md`.
2. **GitHub integration.** [features/github-integration.md](./features/github-integration.md) will be expanded; plan to follow.
3. **Drive write-back + Sheets.** Reuses existing Google OAuth; cheapest auth lift after step 1.
4. **Notion integration.** New OAuth provider.
5. **File access (Full Disk Access).** Big trust ask — placed after the user has already opted in to lighter integrations.
6. **Unified search.** Lands last because it depends on the data shapes that steps 1–5 produce.

## Cross-cutting acceptance criteria

Apply to Phase 2 as a whole:

1. Every new outbound host is in the HTTP allowlist and named in a feature spec.
2. Every new permission ask is gated behind an explicit user opt-in in Settings (default off).
3. Every new event kind in `activity.kind` is rendered by the activity timeline view from step 1.
4. `pnpm typecheck && pnpm lint && pnpm test` is clean after each step.
5. `keytar` stores every OAuth token; no token ever lands in SQLite or `.env`.

## Reporting

After finishing each numbered step above, run typecheck + lint + tests and report green before moving on. Per the project CLAUDE.md plan-then-delegate workflow: write the per-step plan first under `docs/plans/`, then dispatch implementer subagents.
