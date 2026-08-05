# Plover — Phase 3 Overview

Phase 3 is organized as a set of independent **bets**. Each bet is a self-contained
piece of product value with its own spec + implementation plan, shippable without
the others. This lets us sequence and de-risk work one bet at a time and add new
bets as they earn their place.

The product motivation lives in the [product spec](../2026-05-24-task-tracker-agent-product-spec.md).
[Phase 1 architecture](../phase-1/core-architecture.md) and the [Phase 2 overview](../phase-2/overview.md)
remain authoritative for everything they cover — Phase 3 only adds. Where a Phase 3
bet supersedes a Phase 2 stub, the bet spec says so explicitly.

## Bets

| # | Bet | Status | Spec |
|---|-----|--------|------|
| 1 | **MCP integrations** — one-click context sources (Google, GitHub, Notion) that feed the agent richer signal | Spec'd | [bets/mcp-integrations/overview.md](./bets/mcp-integrations/overview.md) |
| 2 | **Translations** — multi-language capture, planning, and nudges | Stub | [bets/translations.md](./bets/translations.md) |
| 3 | **Better tracking** — higher-fidelity activity/progress inference | Stub | [bets/better-tracking.md](./bets/better-tracking.md) |

Bet 1 is fully specified and is what we are going off of now. Bets 2+ are stubs —
enough to reserve the shape and surface cross-bet concerns, expanded into full
specs when their turn comes.

## Adding a bet

1. Add a row to the table above (`Stub` status, link to the stub file).
2. Create `bets/<bet-name>.md` (or `bets/<bet-name>/overview.md` if it decomposes
   into sub-phases, like MCP integrations does).
3. When the bet is picked up, brainstorm it into a full spec, flip status to
   `Spec'd`, then write its implementation plan under `docs/plans/`.

Keep bets independent. If two bets share infrastructure, that shared piece is
either its own bet or lives in the earlier bet's spec — never an implicit
dependency.

## Naming note: "phase" is overloaded

- **Phase 3** here is the *repo roadmap phase* (this document).
- **MCP - Phase 1 / 2 / 3** are the *provider sub-phases within the MCP
  integrations bet* (Google, then GitHub, then Notion). Subtasks for that bet are
  labeled `MCP - Phase N` per the ticket.

These are different axes. A subtask labeled `MCP - Phase 2` is GitHub work inside
the Phase 3 roadmap.

## Cross-cutting constraints (Phase 3)

The Phase 1 and Phase 2 constraints still hold. Phase 3 reaffirms:

1. **Local-only data.** SQLite + local filesystem. Provider OAuth tokens live in
   the OS keychain (`keytar`), never in SQLite. Synced content and cursors live in
   local SQLite.
2. **Outbound HTTP allowlist.** Every new host a bet talks to must be named in that
   bet's spec before code adds it. (Note: the allowlist is currently documented but
   unenforced in code — see the MCP bet's "constraint reconciliation" section.)
3. **Backend proxy stays Gemini-only.** `plover-server` proxies Gemini calls to
   protect the developer key. Provider APIs called with a *user's own* OAuth token
   are called directly from the `Sync` module (as Google is today), not proxied.
4. **Privacy posture.** Content only leaves the device through the existing,
   consented Inference/Vision path to the Gemini proxy. No new silent uploads.
