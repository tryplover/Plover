# Cost-Efficient Tiered Inference over Activity

**Date:** 2026-08-09
**Status:** Design — pending implementation plan

## Problem

The `InferenceEngine` (`app/src/main/activity/processing/inference/inference.ts`)
reads activity via `ActivityRepo.listSince(lastInferenceTs)` and hands the raw
event batch to Gemini through the backend proxy (`/api/infer-progress`). Two cost
problems fall out of this:

1. **Unbounded, noisy payloads.** High-frequency producers flood the batch —
   window-focus samples every 10s (~360 rows/hour), plus screenshots. The model
   pays tokens to read hundreds of near-identical rows.
2. **Timer-driven calls regardless of signal.** Inference fires on a cadence
   (30m baseline, 10m when a task just went in-progress) even when nothing
   task-relevant happened, spending tokens on empty windows — which also invites
   hallucinated progress.

Vision is the worst offender: each screenshot carries a large vision-token load,
and today capture and inference are coupled (`ScreenCapturer` infers per-frame
via `/api/infer-screen`).

## Guiding principle

**The cheapest token is the one you never send.** The largest cost reductions
come from deterministic, local (SQL/JS) work done *before* any model call, not
from a cleverer LLM summarization hierarchy. Use the LLM only on compact,
salient inputs; escalate to a bigger model rarely.

## Goals

- Cut LLM cost by ~an order of magnitude on both axes (calls/day × tokens/call)
  with no loss of inference quality.
- Decouple screenshot *capture cadence* from *inference cadence*.
- Keep all persistence local and inside the existing Store/Inference module
  boundaries.

## Non-goals

- Vector DB / embeddings (deferred — see "Deferred").
- Changing the consent model for screen capture (`screenCaptureEnabled` opt-in,
  default off; backend→Gemini allowlist unchanged).
- New scheduling responsibilities in the Inference module (it still never
  schedules; cadence/timers stay in the activity orchestrator, `activity/index.ts`).

## Architecture

A layered pipeline. Each layer only escalates to the next when the cheaper layer
can't answer:

```
raw activity ─▶ (1) deterministic digest ─▶ (2) salience gate ─▶ (3) LLM progress pass ─▶ summaries
                     (SQL/JS, free)            (SQL/JS, free)        (batched, model-routed)
                                                                           │
screenshots ─▶ capture 5m ─▶ buffer ─▶ dedup+filter ─▶ (4) batched Vision call ─┘
              (local disk)            (pHash, free)      (multi-image, 60m / event / cap)

(5) coarse rollups (daily/weekly): summarize summaries, lazily, on UI demand
```

### (1) Deterministic aggregation — the digest builder (no LLM)

A pure function `buildDigest(activityRows, windowStart, windowEnd) → Digest` that
collapses raw activity into a compact structured summary:

- Focus rows → durations per app / URL host / repo.
- Commits → subjects verbatim (they're already concise signal).
- Gmail/Calendar/Classroom/GitHub events → counts + salient fields (subject,
  title) already present in the activity payload.

Example digest:

```
window: 09:00–09:30
42m  VSCode · repo:plover
 8m  Chrome · docs.google.com
 2×  git_commit: "fix scheduler off-by-one", "wire retention job"
 1×  gmail: subject "Re: launch checklist"
```

This is lossless for the facts that matter and lossy only for noise. It replaces
the current fast-tick screenshot-strip hack (`inference.ts:114`) with a general
mechanism. Lives in the Inference module; reads `Activity` only.

### (2) Salience gate (no LLM)

`isSalient(digest, activeTasks) → boolean`. Only fire an LLM progress pass when
the digest crosses a threshold. Initial rules (tunable knob):

- a new `git_commit` in the window, OR
- ≥ N minutes of focus on a task-relevant surface (repo/app/URL matching an
  active task's title or associated context), OR
- a new email / calendar / classroom / GitHub event matching an active goal
  keyword.

Empty or non-task-relevant windows are skipped entirely — no call. This
generalizes the existing adaptive cadence from "call on a timer" to "call when
something happened."

### (3) LLM progress pass (batched, model-routed)

- **One call per fired window**, all active tasks batched together (preserve the
  current batching in `inference.ts` — do not fan out per task).
- Input is the **digest**, not raw rows.
- **Model routing (backend concern, `plover-server`):** Gemini Flash for the
  routine digest→progress pass; escalate to Pro only on low confidence.
- **Escalation trigger:** the backend response gains a structured
  `{ needsMoreContext: boolean, confidence: number }`. When `needsMoreContext`,
  the engine widens to the next coarser window (hands the model the prior
  window's summaries too) and re-calls once. This is the concrete answer to the
  earlier "how to decide to escalate" TODO.
- Writes unchanged: per-task `TasksRepo.incrementProgress()` +
  `SummariesRepo.insert({ source: 'inference', ... })` in one transaction, and
  bus events (`task.completed`, `summary.created`).

### (4) Vision pipeline — buffered, deduped, batched

- **Capture:** every 5 min to local disk (unchanged path/retention;
  `ScreenCapturer` writes the PNG and stores only `filePath` in the activity row;
  retention GCs every 6h).
- **Do not infer per frame.** Buffer captured frames.
- **Dedup + filter locally (the real cost win, free):**
  - drop near-identical consecutive frames via perceptual hash / pixel-diff (a
    6-frame buffer often collapses to 1–2 meaningful frames);
  - drop frames whose active window is already well-covered by the focus digest
    or is non-task-relevant.
- **Flush** the surviving frames as **one multi-image Vision call** to
  `/api/infer-screen` (cheaper: shared prompt, one round-trip; better: model sees
  temporal progression). Flush on whichever comes first:
  - **time cap** — default 60 min (vision is the slow corroborating signal, not
    real-time),
  - **a salient event** (commit, task→in-progress) so visual context aligns with
    what happened,
  - **a max-frame cap** so a long session can't grow the buffer unbounded.
- **Division of labor:** the fast/cheap text pass carries real-time progress;
  vision is the slow, batched, corroborating/enriching layer. A ≤60m vision lag
  is acceptable; the event-flush catches visually-completed work sooner.

### (5) Coarse rollups (lazy)

Daily / weekly summaries are computed by summarizing existing `summaries` (tiny
inputs), **on UI demand**, not on a timer — so we never pay for a rollup nobody
views.

## Data model

- `summaries` gains a `level` column (`window` | `daily` | `weekly`) to
  distinguish per-window inference output from coarse rollups. Existing rows
  default to `window`.
- Digests are ephemeral (computed per tick from `activity`); no new table needed
  unless profiling shows recomputation is hot, in which case a `digests` cache
  table is a follow-up, not part of this design.

## Server-side work (plover-server)

These live in the separate `plover-server` Cloud Run service, not `app/src/main`,
and are best captured as their own spec/plan in that repo (see the
`plover-server-ops` skill for the deploy pipeline).

- **`/api/infer-progress` (required).**
  - *Input:* now receives a **digest**, not raw activity rows. The prompt must be
    rewritten to reason over the digest format — it cannot run the old raw-row
    prompt on digest input. This is a breaking change to the endpoint.
  - *Response:* gains `{ needsMoreContext: boolean, confidence: number }` so the
    client knows when to widen/escalate. Additive, backward-compatible.
- **Model routing (recommended, server-only).** Gemini Flash for the routine
  digest→progress pass; Pro only on low confidence. This is where the model-tier
  cost win lands — the client holds no Gemini key. Preserve the existing 429
  free-tier fallback.
- **`/api/infer-screen` (required).** Accept a **multi-image batch** payload
  instead of a single image, with a prompt that reasons over the temporal
  sequence of frames.

### Contract-first sequencing

The digest input is a breaking change and the desktop client is user-installed,
so an old app build would send raw rows while a new server expects a digest.
Sequence to avoid skew:

1. Land the **additive response fields** (`needsMoreContext`, `confidence`) +
   model routing server-side first — safe, no client dependency.
2. Ship the **client** digest/gate work.
3. Flip the **input shape** last, deploying client + server together (or have the
   server accept both shapes during the transition, gated on a client-version
   header).

## Deferred

- **Vector DB / embeddings.** YAGNI: the digest + gate keep context small enough
  that semantic retrieval isn't needed, and embeddings add per-event cost + a new
  store that bumps the "Store owns all SQLite" boundary. If semantic recall ever
  becomes necessary, the first stop is **SQLite FTS5** (in-process via
  better-sqlite3, no heavy dep) — not a vector DB.

## Module-boundary compliance

- Digest builder + salience gate + progress pass live in the **Inference**
  module; they read `Activity` + `Tasks`, write `Summaries` + progress. Inference
  still never schedules.
- Cadence/timers and the vision buffer flush remain in the activity orchestrator
  (`activity/index.ts`), which owns scheduling.
- All Gemini calls stay behind `authedFetch` → backend proxy. No Gemini SDK/key
  in the app.

## Testing

- **Digest builder:** pure function — unit test with fixture activity rows
  (durations aggregation, commit passthrough, event counts). TDD.
- **Salience gate:** pure function — table-driven tests over each rule. TDD.
- **Escalation:** engine test with a mocked backend returning
  `needsMoreContext: true`, assert one widened re-call and no infinite loop.
- **Vision dedup:** unit test pHash/diff drops near-identical frames; flush
  triggers (time cap, event, frame cap) tested with injected clock/events.
- No real network — recorded fixtures via `nock` per repo convention.

## Open knobs (tune during implementation)

- Salience threshold sensitivity (missed real progress vs. wasted calls).
- Vision flush time cap (30 vs 60 min) and max-frame cap.
- Confidence threshold that triggers escalation.
