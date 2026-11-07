# Feature: Notion integration (stub)

> Read [../overview.md](../overview.md) first.
>
> **Status:** stub. Expand to a detailed spec before writing its plan.

Connect Plover to Notion so the agent can:

- read pages and database rows as **context** for decomposition (e.g. "this goal is about the OKR doc the user keeps editing"),
- write tasks back as **database rows** (or page subbullets) in a user-chosen Notion database,
- detect when the user is actively editing a Notion page and log it to `ActivityRepo`.

## Open questions (resolve before plan)

1. **OAuth flow.** Notion's "Public Integration" OAuth flow with a server-side callback. Backend proxy hosts the callback; refresh tokens are not used by Notion (single long-lived `access_token`).
2. **Workspace + database picker.** After OAuth, the user picks which databases to expose to Plover. Settings UI lists picked databases; goals can target one.
3. **Activity detection.** No webhooks for free-tier integrations. Polling `databases.query({ sorts: [{ timestamp: 'last_edited_time' }] })` per chosen database every 10 minutes for recently edited rows.
4. **Schema mapping.** When pushing a subtask to a Notion database, what columns get filled? Title is required. Status, Due, Estimate are conditional on the database having those columns. Provide a per-database mapping in Settings.
5. **Rate limiting.** Notion API allows ~3 requests/sec per integration. Stay well under.

## Sketch of module additions

- `app/src/main/activity/notion-tracker.ts` — periodic poller over selected databases / pages.
- `app/src/main/sync/notion.ts` — read + write Notion API surface.
- `server/src/notion/` — OAuth callback (the integration's redirect must be a server we control).
- Settings UI: connection state, picked databases, per-database column mapping.

## Hard constraints

- Add `api.notion.com` to the allowlist. OAuth callback hits the backend proxy, not the renderer.
- Notion access tokens in `keytar`.
- Read scope only by default; write requires per-database opt-in in Settings.

## Out of scope for this feature

- Notion Search beyond chosen databases (lives in unified-search).
- Full block-tree editing (write only top-level pages or DB rows in v1).
- Notion AI features.
