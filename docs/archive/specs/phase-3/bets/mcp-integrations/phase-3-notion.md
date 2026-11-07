# MCP - Phase 3: Notion (diffs since snapshot)

Add a Notion connector that tracks **only new diffs since the last snapshot** —
edited pages, changed database rows, and comments/@-mentions — across a
**user-selected** set of pages/databases (not the whole workspace).

Read [./overview.md](./overview.md) first — connector architecture, `sync_cursors`,
and constraints are defined there.

## Scope

In scope (read/context only):

- **Edited pages** — pages created/edited since the snapshot: title,
  `last_edited_time`, page id, and which top-level blocks changed (ids only, not full
  block content).
- **Database rows** — new/changed rows in watched databases: property changes,
  status moves, `last_edited_time`.
- **Comments + mentions** — new comments and @-mentions directed at the user.
- **User picks what to watch** — the user selects specific pages/databases; we do not
  crawl the entire workspace (reduces noise + scope + token cost).

Out of scope: write-back (creating/editing pages or rows), full block-tree
content sync, file/attachment download.

## Auth

New provider auth `app/src/main/sync/notion-auth.ts`:

- **Notion public OAuth** integration. The loopback desktop flow exchanges the code
  for an access token. Notion access tokens are long-lived (no refresh flow).
- Store the token in **keytar** (service `plover`, account `notion-access-token`).
- Notion's OAuth also returns the set of pages/databases the user granted during the
  connect flow — use that grant as the initial watch set.
- Client id/secret from env with dev fallbacks (`NOTION_CLIENT_ID` /
  `NOTION_CLIENT_SECRET`). Notion API version pinned via the `Notion-Version` header.

## Watch selection

- Seed the watch set from the OAuth grant, then let the user refine it in Settings.
- Persist watched targets in `settings`
  (`notionWatched: { pages: string[]; databases: string[] }`).

## Per-source diff mechanism

Notion has no global change-feed; poll with `last_edited_time` filters + pagination.

| Source | Cursor (`sync_cursors.source`) | Fetch since cursor | First-snapshot behavior |
|--------|-------------------------------|--------------------|-------------------------|
| Pages | source `pages` → ISO ts | `POST /v1/search` filtered to pages, sort by `last_edited_time`, stop once older than cursor | Record `now`, emit nothing |
| DB rows | source `db:<id>` → ISO ts (per watched DB) | `POST /v1/databases/{id}/query` with `last_edited_time` filter `>` cursor | Record `now` per DB, emit nothing |
| Comments | source `comments` → ISO ts | `GET /v1/comments?block_id=...` for watched pages; filter created after cursor; keep those mentioning the user | Record `now`, emit nothing |

Changed-block detection for pages: compare current top-level block ids/`last_edited_time`
against the last seen set for that page (store the compact id→ts map in the activity
payload's predecessor or a small per-page cache row in `sync_cursors` keyed
source `page:<id>`). Emit changed block ids only — never full block content.

Respect Notion's ~3 requests/sec rate limit with a client-side throttle; honor
`Retry-After` on `429`.

## Activity kinds + events

Add to `activity-types.ts` (zod schema each) + event bus:

| `activity.kind` | Bus event | Payload (minimal) |
|-----------------|-----------|-------------------|
| `notion_page_edited` | `notion.page` | `{ pageId, title, url, changedBlockIds[], lastEditedAt }` |
| `notion_db_row` | `notion.dbRow` | `{ databaseId, pageId, title, changedProps[], status?, lastEditedAt }` |
| `notion_comment` | `notion.comment` | `{ pageId, commentId, author, snippet, mentionsUser, createdAt }` |

## Store / settings

- `sync_cursors` rows: `notion/pages`, `notion/comments`, `notion/db:<id>` per DB,
  and `notion/page:<id>` block-map caches.
- `settings`: `notionConnected` flag; `notionTrackingEnabled` toggle; `notionWatched`
  selection.

## UI

- Replace the Notion "coming soon" placeholder in `StepConnect.tsx` with a connect
  button; after OAuth, show the granted pages/databases and let the user pick which
  to watch.
- Settings: toggle, watch-set management, last-sync time.

## Subtasks (`MCP - Phase 3`)

1. `MCP - Phase 3` — `notion-auth.ts` OAuth + keytar token; `Notion-Version` pin.
2. `MCP - Phase 3` — Watch-set selection UI seeded from the OAuth grant + `notionWatched` settings.
3. `MCP - Phase 3` — Pages connector (search + changed-block diff) + `notion_page_edited` kind/schema/subscriber.
4. `MCP - Phase 3` — DB-rows connector (per-DB `last_edited_time` query) + `notion_db_row` kind/schema/subscriber.
5. `MCP - Phase 3` — Comments/mentions connector + `notion_comment` kind/schema/subscriber.
6. `MCP - Phase 3` — Wire Inference to consume the new kinds; connect + watch-set UI.

## Testing

- TDD diff/cursor logic (first-snapshot, `last_edited_time` filtering, per-page
  changed-block detection, per-DB cursors, `429`/`Retry-After` handling). `nock`
  fixtures for the Notion API. No real network.

## Acceptance

1. Connect + pick watch set; first sync emits no backlog.
2. Subsequent polls emit only pages/rows/comments changed since the cursor.
3. Access token in keytar only; cursors in `sync_cursors`.
4. Rate-limit-aware (throttle + `Retry-After`); `pnpm typecheck && pnpm lint && pnpm test` clean.
