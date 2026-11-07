# Feature: Unified search across all sources (stub)

> Read [../overview.md](../overview.md) first.
>
> **Status:** stub. Expand to a detailed spec before writing its plan.

A single search box that returns hits across local files, activity, GitHub, Notion, Drive, and the user's own goals/tasks. Lands **last** in Phase 2 — depends on every other Phase 2 feature for its data sources.

## Open questions (resolve before plan)

1. **Index location.** Single FTS5 virtual table (`search_index`) inside the existing SQLite DB. Schema in [../overview.md](../overview.md#data-model-additions).
2. **Per-source freshness.** Some sources have local-canonical data (files, activity), some are cached projections of remote APIs (GitHub issues, Notion pages, Drive Docs). Cached projections need a TTL + manual re-index.
3. **Ranking.** FTS5 default BM25, plus a recency boost (`ts` DESC) and a per-source weight the user can tune.
4. **UI placement.** Global hotkey (similar to overlay quick-add) opens a search palette. Reuse the overlay window primitive.
5. **Privacy.** Search results from Notion / GitHub / Drive depend on which integrations the user has connected. If an integration is paused, hide its rows from search results (don't delete the index — just filter at query time).

## Sketch of module additions

- `app/src/main/store/repos/search-index.ts` — wraps the FTS5 virtual table; one writer per source.
- `app/src/main/search/index.ts` — query API: `search(q, opts) → SearchHit[]`.
- `app/src/renderer/search/` — new palette UI.
- Each Phase 2 feature owns its own indexer that writes into `search_index` (e.g. `github-tracker` indexes PR titles + descriptions when it sees them).

## Hard constraints

- Index is local-only. No remote search.
- One writer per source — sources do not cross-index each other.
- The palette must work offline for any source whose data is already indexed.

## Out of scope for this feature

- Semantic search / embeddings (BM25 only in v1).
- Cross-account search (single user, single workspace per provider).
- Full-text history (only the current state of remote sources, not their edit history).
