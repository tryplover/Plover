# Image Capture Adaptive Interval Implementation Plan

> **Standalone plan** — written to be opened in a fresh conversation with no
> prior context. It's one isolated piece of a larger "reduce screenshot/Gemini
> Vision cost and improve responsiveness" effort. A sibling piece, window-change
> gating, has already shipped (see "Depends on" below) — this plan assumes it's
> already in the codebase and builds on it, but does not re-explain or re-derive
> it beyond what's needed here. Another sibling piece (downscaling the uploaded
> image) is a separate, independent change tracked elsewhere — don't pull it in.

**Goal:** Replace the flat, fixed screenshot-capture timer with one that adapts
its pace: check frequently right after the user switches to something new, and
back off to a slower pace during long stretches where nothing has changed.

**Important honest reframing — read before implementing:** the already-shipped
window-change gating (see "Depends on") means Plover already skips the *paid
Gemini Vision call* whenever the active window hasn't changed since the last
successful call, regardless of how often the capture timer fires. So making the
timer itself adaptive does **not** meaningfully reduce Gemini spend on its own —
that reduction already happened. What this change actually buys is:
1. **Lower latency** — catching a genuine context switch sooner than "wait up to
   the next flat interval" (today, up to 5 minutes late in the worst case).
2. **Less wasted local overhead** — every tick still does a real screen capture
   and disk write even when gating skips the network call; backing off during
   idle stretches avoids that local work when it's least likely to be useful.

Both are real, worthwhile improvements — just don't oversell this internally as
"more dollars saved." Frame it as "a smarter, more responsive capture rhythm"
when discussing it.

**Depends on:** window-change gating in `app/src/main/activity/screen-capturer.ts`
(a `settings.lastVisionInferenceWindowKey` check inside `captureOnce()`, gating
whether `runInference()` is called). If that isn't present in the checkout this
plan is opened against, stop and confirm before proceeding — this plan assumes it
exists but doesn't require modifying it.

## Context on the codebase

- `ScreenCapturer.start()` (`app/src/main/activity/screen-capturer.ts`) uses a
  recursive `setTimeout` loop (not `setInterval`, so ticks never overlap): each
  tick calls `captureOnce()`, then re-reads
  `settingsRepo.getAll().screenCaptureIntervalMinutes` and schedules the next
  tick at that flat interval (clamped 1–60 minutes, see `SettingsRepo`).
- `captureOnce()` always performs a real screen capture and disk write on every
  tick, regardless of the vision-gating outcome — only the *paid* call is
  conditionally skipped, not the capture itself.
- **No existing test coverage of `start()`'s timer loop** — the current test
  file (`app/tests/activity/screen-capturer.test.ts`) only exercises
  `captureOnce()` directly, calling it manually rather than driving the
  `setTimeout` chain. This plan's test task will need to introduce fake-timer
  based testing for the first time in this file — budget real time for that,
  it's not just "add a few more assertions."

## Architecture

**Backoff algorithm** (a standard, well-understood pattern — the same idea many
polling/sync clients use: check often right after activity, back off when idle):

- Track an in-memory (not persisted — resetting to the fast pace on every app
  restart is fine and simpler) "current interval" on the `ScreenCapturer`
  instance, starting at a new constant `MIN_CAPTURE_INTERVAL_MINUTES` (suggest
  `1`).
- After each tick, independent of whether vision inference is enabled at all,
  determine whether the active window changed since the previous tick (reuse the
  same "compare current `window_focus` row to the last one seen" idea already
  established by the gating feature — but track it as its own, separate
  in-memory field here; **do not** read or write the persisted
  `settings.lastVisionInferenceWindowKey`, since that field's job is specifically
  "was vision already run for this exact window," not general pacing state, and
  entangling the two would make both harder to reason about).
- If the window **changed**: reset the current interval to
  `MIN_CAPTURE_INTERVAL_MINUTES`.
- If the window **did not change**: grow the current interval (suggest doubling)
  up to a ceiling.
- **Open decision, needs a call before or during implementation**: what the
  ceiling should be. The existing `screenCaptureIntervalMinutes` setting today
  means "the flat rate" — repurposing it as "the slowest allowed pace when idle"
  is a reasonable, minimal-surface-area choice (no new setting needed), but it
  is a real, user-visible semantics change to an existing setting, not a pure
  implementation detail. Recommend proceeding with that reinterpretation (ceiling
  = current `screenCaptureIntervalMinutes` value, default 5), but call this out
  explicitly if there's any Settings UI copy describing the setting that would
  become misleading, and update it if so.
- Use the adaptive current-interval value (not the flat setting value) when
  scheduling each `setTimeout` in `start()`'s tick loop.

## Global constraints (repo conventions)

- TypeScript strict (`noUncheckedIndexedAccess`, etc.) — don't loosen tsconfig.
- No new dependency needed — this is timer/state bookkeeping, no library
  required.
- No comments except where the WHY is non-obvious (e.g. why pacing state is
  intentionally separate from the persisted vision-gating key).
- Path-based pnpm filter for all commands: `pnpm --filter ./app run <script>`.

## File Structure

```
app/src/main/activity/
└── screen-capturer.ts    (modify: adaptive interval state + backoff logic in
                            start()'s tick loop and captureOnce())

app/tests/activity/
└── screen-capturer.test.ts   (modify: add fake-timer-based coverage of the
                                backoff behavior — new test infrastructure)
```

## Task 1: Add adaptive interval state and backoff logic

**Files:** modify `app/src/main/activity/screen-capturer.ts`

- [x] Add `const MIN_CAPTURE_INTERVAL_MINUTES = 1;` near the top of the file.
- [x] Add private instance fields to `ScreenCapturer`: something like
      `private currentIntervalMinutes: number | null = null;` (null = "not yet
      established, use the minimum") and `private lastSeenWindowKey: string |
      null = null;` (separate from the persisted vision-gating key, see above).
- [x] Inside `captureOnce()`, after (or alongside) the existing window_focus
      lookup used for vision gating, independently look up the latest
      `window_focus` row, compute its key, compare to `this.lastSeenWindowKey`,
      update `this.lastSeenWindowKey`, and set
      `this.currentIntervalMinutes` accordingly: reset to
      `MIN_CAPTURE_INTERVAL_MINUTES` on a change, otherwise double the current
      value (defaulting from `MIN_CAPTURE_INTERVAL_MINUTES` if it's still
      `null`), clamped at `settings.screenCaptureIntervalMinutes` as the ceiling.
- [x] In `start()`'s `tick` closure, replace the flat
      `settingsRepo.getAll().screenCaptureIntervalMinutes` read (used to compute
      `intervalMs` for the next `setTimeout`) with
      `this.currentIntervalMinutes` (falling back to
      `MIN_CAPTURE_INTERVAL_MINUTES` if still unset, e.g. before the first tick
      has run).
- [x] Double check `stop()` still works unchanged — no new state needs cleanup
      there beyond what already exists.

## Task 2: Tests

**Files:** modify `app/tests/activity/screen-capturer.test.ts`

This file has no fake-timer precedent yet, so this task includes establishing
that pattern, not just adding assertions to an existing one.

- [x] Add a new `describe('adaptive capture interval', ...)` block. Use
      `vi.useFakeTimers()` in its `beforeEach` and `vi.useRealTimers()` (or
      `vi.restoreAllMocks()`, whichever the repo's other fake-timer tests
      elsewhere use as precedent — search the wider `app/tests` tree for an
      existing `useFakeTimers` example before inventing a new pattern) in
      `afterEach`.
  - Recall `now: () => new Date(...)` is already injectable via
    `ScreenCapturerDeps` — keep using that for deterministic timestamps
    alongside fake timers for the scheduling itself.
- [x] Test: starting fresh, then repeatedly advancing fake time and letting
      ticks fire with **no** `window_focus` changes between them — assert the
      scheduled interval grows each time (e.g. 1 min → 2 min → 4 min) up to the
      `screenCaptureIntervalMinutes` ceiling, and does not exceed it.
- [x] Test: after the interval has backed off, log a new/changed `window_focus`
      row before the next tick fires — assert the *following* scheduled interval
      drops back to `MIN_CAPTURE_INTERVAL_MINUTES`, not a continuation of the
      backed-off value.
- [x] Test: confirm this pacing logic runs (and adapts) even when
      `screenVisionInferenceEnabled` is `false` — since it's meant to reduce
      local capture overhead generally, not just pace the vision call.
- [x] Re-run the full existing suite in this file to confirm the window-change
      *gating* tests (a separate, already-shipped feature) still pass unmodified
      — this task must not change that behavior, only the scheduling cadence
      around it.

## Verification

- `pnpm typecheck && pnpm lint && pnpm test` (repo root) must all pass.
- No UI surface for this change — no manual `pnpm dev` check needed, unit tests
  (with fake timers) are the right verification tool here.
- If there's Settings UI copy anywhere describing
  `screenCaptureIntervalMinutes` as "how often Plover takes a screenshot" (flat
  framing), it's worth a quick check whether that copy needs a tweak now that
  the setting means "at most this often when idle" rather than "exactly this
  often" — not a blocking requirement, but flag it if found.
