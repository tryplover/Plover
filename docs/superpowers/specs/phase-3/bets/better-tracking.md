# Bet 3 — Better tracking (stub)

**Status: stub.** Reserves the shape; expand into a full spec when picked up.

Raise the fidelity of Plover's activity → progress inference so nudges and progress
signals reflect what the user is actually doing, not just coarse heuristics.

## Rough shape (to be validated in brainstorming)

- Richer activity signals feeding Inference (builds on the MCP integrations bet's new
  `activity` kinds + existing screen/window/commit trackers).
- Better `progress_signal` inference: correlate cross-source activity (a merged PR +
  an edited Notion doc + a calendar event) to a task.
- Adaptive polling cadence per source (note the `plover-store-schema` footgun:
  `tasks.created_at`/`updated_at` are unreliable age signals).

## Open questions

- What's the unit of "progress" — per task, per goal, per session?
- How much correlation logic is local vs. Gemini-inferred via the proxy?
- How do we evaluate tracking quality without a labeled dataset?

## Cross-bet notes

- Directly consumes the MCP integrations bet's output: the more context sources land
  in `activity`, the more this bet has to work with. Sequence this **after** MCP
  integrations so it has real signal to infer from.

When picked up: brainstorm → full spec here → implementation plan under `docs/plans/`.
