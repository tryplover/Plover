# Peek — round 2 brief (shared by all agents)

## Product
Plover is a calm desktop work buddy for people with ADHD: a small bird that sits at the edge of your screen,
breaks tasks into steps, runs a focus timer and gently reminds you to lock in. Brand feel: **calm, trustworthy,
focused**, lightly playful. Audience wants something cute that sits next to them while they study/work.

## Chosen direction so far
"Peek": a round cream bird peeking into a rounded-square app tile from an edge. The founder's current favourite is
the **calm side peek** — profile head entering from the bottom-right, closed content eye (a ◡ arc), long straight
beak pointing left, one pointed feather-tip wing at the bottom edge. Reference file:
`design/logo-concepts/round-1/build_side.py` (variant "5 · Calm side peek", no band) and its render
`design/logo-concepts/round-1/renders/side-peek.png`.

Geometry of that reference (viewBox 0 0 256 256): tile `rect 256x256 rx=56`, head `circle cx=168 cy=226 r=112`,
eye `path M108 168 Q122 182 136 168` stroke 8 round caps, beak `M66 178 Q40 186 22 196 Q42 206 68 212 Z`,
wing `M138 260 C138 236 152 222 164 210 C176 222 190 236 190 260 Z` with a 5px light gap stroke.

## Palette — Sage (locked)
- tile / primary `#5E7F6B`
- bird light `#F3EEE1`
- wing tone `#D9CFB4`
- ink (eyes, details) `#2F4236`
- beak accent `#E3B55B`
- page background `#F6F3EA`

## Style rules
- Flat vector, no gradients/shadows/filters. Few, simple geometric shapes (circles, arcs, clean beziers).
- Bird must read as a **bird** (beak is the key cue), calm (soft eyes, slow easing), not a chick/penguin/owl.
- Not Duolingo (no huge round eyes, not front-on owl), not Twitter (no flying profile silhouette).
- Must still read at 32 px; note honestly how it does at 16 px.

## Deliverable (each agent)
One self-contained HTML file in `design/logo-concepts/round-2/` (inline SVG + CSS/JS only, no external libs,
Google Font Inter allowed), containing:
1. **Static icon** at 220 px plus true 64 / 32 / 16 px versions.
2. **Animated loop** of the icon at ~260 px: a full idle/peek animation (6–10 s loop), e.g. enter → settle →
   blink/breathe → small personality beat → exit or rest. Use CSS keyframes or SMIL; ease gently (calm!).
3. **Storyboard**: 5–6 static key poses side by side, each labelled (pose name + what it signals in the app:
   e.g. "idle", "focus started", "check-in", "break time", "nice work").
4. One-paragraph rationale at the top.

## Process
- Render and LOOK at your work: `python "C:/Users/hhl_c/.claude/plugins/cache/logo-design-skill/logo-design/1.4.4/skills/logo-design/scripts/render_png.py" <file>.html -o <dir>/renders/<name>.png --width 1300 --height 1400`
  (Chrome headless; it captures one frame, so the storyboard row is what you check). Read the PNG and fix issues
  (clipping, overlapping shapes, things too small at 32 px). Iterate at least twice.
- Only write inside `design/logo-concepts/round-2/`. Do not touch git (no commits, branches, stash).
- Report back: file path, render path, 3-sentence summary of the direction, and honest weaknesses.
