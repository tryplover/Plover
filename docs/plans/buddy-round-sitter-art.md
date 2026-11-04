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

## Revision: switch to the Oct 16 drawing

The founder chose the website's Oct 16 revision of the bird over the Oct 4 concept (face centred, wings tucked behind the ball, no sand cap). Source: `Buddy` in `plover-website/src/components/landing/Buddy.jsx` (main). Same 256×280 frame, ball centre (128,142) r=100, so the `extras` (z, dots, sparks) keep their coordinates.

### Task 4: Redraw `Buddy.tsx`

Keep the root `div`, `LABEL`, props and the `extras` group exactly as they are. Drop the `clipPath`/`useId` (the new drawing has no cap). Replace the shadow, body, head and wings with this structure (colours: CREAM `#F3EEE1`, INK `#2F4236`, SAND `#D9CFB4`, AMBER `#E3B55B`; EDGE = `stroke INK, strokeOpacity 0.28, strokeWidth 3`), drawn in this order so the wings sit behind the ball:

- `plover-buddy__shadow`: `ellipse cx=128 cy=256 rx=70 ry=9 fill SAND opacity .75` (outside `__body`, so it stays on the ground).
- `g.plover-buddy__body` containing, in order:
  - feet: `ellipse cx=108 cy=244 rx=11 ry=6` and `cx=148`, fill SAND + EDGE.
  - `g.plover-buddy__wings` (fill SAND) with `g.plover-buddy__wing.plover-buddy__wl` → `ellipse cx=25 cy=176 rx=18 ry=35 transform="rotate(22 25 176)"` + EDGE, and `g.plover-buddy__wing.plover-buddy__wr` → `ellipse cx=231 cy=176 rx=18 ry=35 transform="rotate(-22 231 176)"` + EDGE.
  - `g.plover-buddy__headg`: `circle cx=128 cy=142 r=100 fill CREAM stroke SAND strokeWidth=5`; then `g.plover-buddy__face` holding the eye sets and the beak `path d="M113 146 H143 L128 168 Z" fill/stroke AMBER strokeWidth=8 strokeLinejoin=round`.
- Eye sets inside `__face` (each a `g`, all hidden by default via CSS):
  - `plover-buddy__e-pill` (open): `rect x=91.5 y=111 w=13 h=23 rx=6.5` and `x=151.5`, fill INK.
  - `plover-buddy__e-arc` (closed): paths `M87 120 Q98 132 109 120`, `M147 120 Q158 132 169 120`.
  - `plover-buddy__e-happy`: paths `M87 128 Q98 115 109 128`, `M147 128 Q158 115 169 128`.
  - `plover-buddy__e-sleepy` (new): `rect x=91.5 y=121 w=13 h=10 rx=5` and `x=151.5`, fill INK.
  - Arc/happy paths: `fill none, stroke INK, strokeWidth 7, strokeLinecap round`.

### Task 5: Update `Buddy.css`

- Add `.plover-buddy__e-sleepy` to the hidden-by-default eye list.
- Wing origins (shoulders): `.plover-buddy__wl { transform-origin: 36px 144px }`, `.plover-buddy__wr { transform-origin: 220px 144px }`; remove the inline `style` origins from the TSX.
- break: show `__e-sleepy` instead of `__e-arc`.
- celebrating wings lift out from behind the ball: `__wl { transform: rotate(40deg) }`, `__wr { transform: rotate(-40deg) }`.
- nudging wave on the right wing must swing outward, so negate the angles: keyframes `40% rotate(-38deg)`, `70% rotate(-22deg)`.
- `.plover-buddy__e-pill` blink origin stays `128px 122px` (eyes are centred now). Everything else unchanged.
