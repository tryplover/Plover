# Image Capture Downscaling Implementation Plan

> **Standalone plan** — written to be opened in a fresh conversation with no prior
> context. It's one isolated piece of a larger "reduce screenshot/Gemini-Vision
> cost" effort; the rest of that effort (window-change gating, already shipped;
> image diffing; adaptive interval) is out of scope here and should not be pulled
> in. Keep this change small and self-contained.

**Goal:** When Plover sends a captured screenshot to the paid `/api/infer-screen`
(Gemini Vision) endpoint, shrink the image first. Vision-model cost scales with
image resolution, and this use case only needs a coarse read ("what app/activity
is on screen"), not pixel-perfect detail — so a smaller upload should cost less
per call with no meaningful loss in answer quality. This only touches what gets
*uploaded*; the full-resolution screenshot still gets written to local disk
unchanged (that copy isn't cost-constrained and may be useful for retention/other
features later).

**Context on the codebase:**

- `app/src/main/activity/screen-capturer.ts` is the only file involved.
  `captureOnce()` (around line 61) captures a screenshot via
  `desktopCapturer.getSources({ types: ['screen'], thumbnailSize: { width: 1920,
  height: 1080 } })`, takes `primary.thumbnail` (an Electron `NativeImage`),
  converts it once to a PNG `Buffer` (`primary.thumbnail.toPNG()`), writes that
  buffer to disk, logs a `screenshot_captured` activity row, and — if
  `screenVisionInferenceEnabled` — calls `private runInference(screenshotId,
  filePath, png, lastFocus, windowKey)`, which currently re-uses the *same*
  full-resolution `png` buffer for the upload body (`screenshotBase64:
  png.toString('base64')`, around line 126).
- A separate, already-shipped feature (window-change gating, see
  `docs/plans/../plans/i-want-to-work-peppy-wind.md` if you have access, but you
  likely don't in a fresh thread — it's not needed to understand this task) skips
  calling `runInference` entirely on unchanged windows. That logic is unrelated
  and must not be touched or re-derived here — leave `captureOnce`'s gating
  branch exactly as-is; only change what happens *inside* the upload path once
  `runInference` is actually invoked.
- Electron's `NativeImage.resize(options: { width?: number; height?: number;
  quality?: 'good' | 'better' | 'best' }): NativeImage` is available with **no new
  dependency** (confirmed in `app/node_modules/electron/electron.d.ts`). Per the
  type declaration, omitted `width`/`height` each independently default to the
  *original* image's corresponding dimension — there is no documented guarantee
  that supplying only one dimension auto-preserves aspect ratio. **Compute both
  target dimensions explicitly** from the original size rather than relying on
  that; don't assume proportional scaling happens for free.

**Architecture:**

- Add a module-level constant, e.g. `const VISION_UPLOAD_MAX_WIDTH = 1024;` at the
  top of `screen-capturer.ts`. Keep it a plain constant, not a new user-facing
  setting — this is meant to stay a small, single-purpose change (no new
  `SettingsRepo` field, no Settings UI). It can become configurable later if
  there's a reason to.
- Thread the original `NativeImage` (`primary.thumbnail`) through to
  `runInference` (it currently only receives the already-converted PNG `Buffer`),
  alongside the existing `size` (`primary.thumbnail.getSize()`) so the resize
  target can be computed.
- Inside `runInference`, before building the upload body: if the image's width is
  already `<= VISION_UPLOAD_MAX_WIDTH`, skip resizing entirely (don't upscale a
  smaller-than-target capture). Otherwise compute
  `targetHeight = Math.round(originalHeight * (VISION_UPLOAD_MAX_WIDTH /
  originalWidth))`, call `thumbnail.resize({ width: VISION_UPLOAD_MAX_WIDTH,
  height: targetHeight })`, and use *that* resized image's `.toPNG()` output for
  `screenshotBase64` — the original full-resolution `png` buffer passed to
  `fs.writeFile` in `captureOnce` must be completely untouched by this change.
- Nothing else about the request/response shape changes — `windowContext`,
  response handling, and the `screenshot_inferred` logging all stay as they are.

**Global constraints (repo conventions — see the project's own `CLAUDE.md` if
available in this checkout):**

- TypeScript strict (`noUncheckedIndexedAccess`, etc.) — don't loosen tsconfig.
- No comments except where the WHY is non-obvious (e.g. why we compute both
  dimensions explicitly instead of relying on a single one).
- No new dependency for this — Electron's built-in `nativeImage.resize` is
  sufficient; don't reach for `sharp` or similar.
- Path-based pnpm filter for all commands: `pnpm --filter ./app run <script>`.

## File Structure

```
app/src/main/activity/
└── screen-capturer.ts    (modify: add resize step in runInference's upload path)

app/tests/activity/
└── screen-capturer.test.ts   (modify: extend mock thumbnail with `.resize()`,
                                add coverage for the new behavior)
```

## Task 1: Add the downscale step

**Files:** modify `app/src/main/activity/screen-capturer.ts`

- [x] Add `const VISION_UPLOAD_MAX_WIDTH = 1024;` near the top of the file.
- [x] Change `captureOnce()`'s call site so `runInference` also receives the
      original `NativeImage` (`primary.thumbnail`) and its `size`
      (`{ width, height }` from `getSize()`), in addition to the existing
      `png` buffer (which continues to be used only for the on-disk write and
      for nothing else).
- [x] Update `runInference`'s signature to accept the `NativeImage` + original
      size, and inside it: if `originalWidth <= VISION_UPLOAD_MAX_WIDTH`, use the
      existing `png` as-is for the upload; otherwise compute the proportional
      target height, call `.resize({ width: VISION_UPLOAD_MAX_WIDTH, height:
      targetHeight })` on the `NativeImage`, and use *that* result's `.toPNG()`
      for the `screenshotBase64` upload field instead of the original `png`.
- [x] Double-check: the `fs.writeFile(filePath, png)` call in `captureOnce` and
      the `screenshot_captured` activity row's `width`/`height` payload must
      still reflect the **original**, full-resolution capture — only the
      network upload shrinks.

## Task 2: Tests

**Files:** modify `app/tests/activity/screen-capturer.test.ts`

The existing mock shape for a capture source is:
```ts
{
  name: 'Entire Screen',
  thumbnail: { toPNG: () => png, getSize: () => ({ width: 100, height: 100 }) },
}
```
This needs a `.resize()` method added to the mocked `thumbnail` object so the
code under test can call it. Suggested pattern: make the mock's `resize()`
return a distinct second PNG buffer (e.g. `Buffer.from([...different bytes...])`)
so tests can assert *which* buffer ended up in the upload body vs. on disk.

- [x] Add a test where the mocked capture is wider than `VISION_UPLOAD_MAX_WIDTH`
      (e.g. `{ width: 1920, height: 1080 }`) and assert:
      - `thumbnail.resize` was called with the expected `{ width: 1024, height:
        576 }` (1920x1080 scaled proportionally to width 1024 — verify the exact
        rounding).
      - The fetch body's `screenshotBase64` decodes to the *resized* mock buffer,
        not the original.
      - The file written to disk (`fs.readFile(filePath)`) still matches the
        *original*, full-resolution buffer.
- [x] Add a test where the mocked capture is already `<= VISION_UPLOAD_MAX_WIDTH`
      (e.g. `{ width: 800, height: 600 }`) and assert `thumbnail.resize` is
      **not** called, and the upload body uses the original buffer unchanged.
- [x] Run the full existing suite in this file to make sure nothing about the
      window-change-gating tests (added in a prior, separate change) regressed —
      they don't need modification, just shouldn't break.

## Verification

- `pnpm typecheck && pnpm lint && pnpm test` (repo root) must all pass.
- This doesn't need a manual `pnpm dev` check — it's a backend/network-payload
  change with no UI surface, fully covered by the unit tests above.
- Worth a manual sanity note (not a blocking test): the exact
  `VISION_UPLOAD_MAX_WIDTH` value (1024 suggested here) is a judgment call, not a
  precisely-derived number — if there's a way to eyeball a couple of real
  `/api/infer-screen` responses at different upload resolutions before locking
  this in, that's worth doing, but isn't required to land this change.
