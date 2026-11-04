# Buddy art: round corner sitter Plan

> **For agentic workers:** UI-only swap of placeholder art. No state, message or worker changes. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Replace the placeholder coloured circle in `extension/src/ui/components/Buddy.tsx` with the approved "round corner sitter" character, animated per the founder's locked motion choices.

**Sources (read-only):**

- Art + per-state CSS: `design/buddy-concepts/round-2/round-buddy.html` (the `<svg class="bird" viewBox="0 0 256 280">` and the `<style>` rules for `[data-s=...]`).
- Locked motion: `design/system/choices.selected.json` → `motion`: idle `gentle-breathing` (5 s), focus `static`, completion `single-small-hop`, reduced `static-with-text-status`.
- Selection record: `design/HANDOFF.md` ("Round corner sitter").

## Global Constraints

- `Buddy` keeps its exact props (`state: BuddyAnimationState`, `onClick?`) and stays the only art component; callers are `entrypoints/content/index.tsx` and `entrypoints/blocked/main.tsx`.
- All CSS class names start with `plover-buddy` (the `plover-extension-wxt` skill reserves that prefix for `Buddy`; generic names like `.body` would collide on the blocked page). Root keeps `plover-buddy plover-buddy--<state>`; inner parts use `plover-buddy__<part>`.
- The SVG `clipPath` id must be unique per instance: use React `useId()` (strip `:` characters, which break `url(#…)`).
- No new dependencies, no new files outside the ones listed. No comments unless the WHY is non-obvious.
- `pnpm typecheck && pnpm lint && pnpm test && pnpm build` green from repo root.

## Task 1: Buddy component (`extension/src/ui/components/Buddy.tsx`)

- [ ] Render a root `<div className={"plover-buddy plover-buddy--" + state} onClick={onClick} role="img" aria-label={LABEL[state]} title={LABEL[state]}>` containing the SVG.
- [ ] `LABEL: Record<BuddyAnimationState, string>`: idle "Plover is resting", working "Plover is working with you", focus "Plover is focusing", break "Plover is on a break", nudging "Plover has something for you", celebrating "Plover is celebrating". (This is the "text status" for reduced motion.)
- [ ] Port the SVG markup verbatim from the source file (shadow ellipse, `extras` group with `x-z`, `x-dots`, `x-spark`, `body` group with feet, `headg` with ball/cap/rim/`face` (eye sets `e-pill`, `e-arc`, `e-happy`, beak), wings `wl`/`wr`), converted to JSX: `class` → `className` with the `plover-buddy__` prefix (`shadow`, `extras`, `x-z`, `x-dots`, `x-spark`, `body`, `headg`, `face`, `e-pill`, `e-arc`, `e-happy`, `wing`, `wl`, `wr`); `stroke-width` → `strokeWidth` etc.; inline `style="transform-origin:46px 202px"` → `style={{ transformOrigin: "46px 202px" }}`; `clip-path="url(#r1)"` → `clipPath={`url(#${clipId})`}`. SVG gets `viewBox="0 0 256 280"`, `width="100%"`, `height="100%"`, `aria-hidden="true"`, `focusable="false"`.

## Task 2: Buddy styles (`extension/src/ui/components/Buddy.css`)

Replace the file. Root:

```css
.plover-buddy { width: 64px; height: 70px; cursor: grab; touch-action: none; }
.plover-buddy svg { display: block; overflow: visible; }
```

Port the source rules, re-keyed from `[data-s=X] .part` to `.plover-buddy--X .plover-buddy__part` and with every keyframe renamed `plover-buddy-<name>`, with these changes required by the locked motion choices:

- [ ] Base: `.plover-buddy__e-arc, __e-happy, __e-pill, __extras > g { opacity: 0; transition: opacity .4s }`; `transform-box: view-box` on `__body, __headg, __face, __wing, __e-pill`; the same transform-origins and transitions as the source.
- [ ] Breathing applies to `idle`, `working`, `break` and `nudging` only (not focus, not celebrating), duration **5s** (source 4.5s).
- [ ] idle: arc eyes. working: pill eyes + blink + glance (as source). break: arc eyes, head tilt, `x-z` drift (as source). nudging: pill eyes, dots, head tilt, right-wing wave (as source).
- [ ] focus: **fully static**: arc eyes, `__body { animation: none; transform: scale(.86) }`, wings `translateY(8px)`.
- [ ] celebrating: happy eyes, sparks, wings out (as source), and the hop runs **once**: `animation: plover-buddy-hop 1.4s cubic-bezier(.3,.6,.3,1) 1` (source loops `infinite`).
- [ ] `@media (prefers-reduced-motion: reduce) { .plover-buddy, .plover-buddy * { animation: none !important; transition: none !important; } }` (poses still change; the `title`/`aria-label` carries the status).

## Task 3: Content-script sizing (`extension/src/entrypoints/content/index.tsx`)

The blob is now 64×70 instead of 56×56.

- [ ] Replace `const SIZE = 56;` with `const BUDDY_WIDTH = 64;` and `const BUDDY_HEIGHT = 70;`.
- [ ] Drag centring: `setDrag({ x: e.clientX - BUDDY_WIDTH / 2, y: e.clientY - BUDDY_HEIGHT / 2 })`.
- [ ] `placeFrame` offset uses `BUDDY_HEIGHT` in place of `SIZE`.
- [ ] Remove any other `SIZE` reference by choosing width or height by meaning.

## Verification (orchestrator)

- `pnpm typecheck && pnpm lint && pnpm test` green; `pnpm build` succeeds.
- Render `Buddy` for all six states in a Playwright harness and inspect the screenshot; confirm the reduced-motion media query stops animation.
