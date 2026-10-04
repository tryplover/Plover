# Buddy on the desktop — brief (shared by all agents)

## Context
Plover is a calm desktop work buddy for people with ADHD (spec: `docs/superpowers/specs/2026-10-02-desktop-buddy-pivot-spec.md`,
§3 and §4). The buddy lives in a small, always-on-top, frameless window; it never blocks work, can be moved, minimised
or dismissed. MVP features it hosts: task breakdown (steps), Pomodoro timer, site blocking, focus mode, read-only
calendar. Tone: encouraging, never guilt-tripping. Feel: **calm, trustworthy, focused**, lightly playful.

## The character (decided direction)
The founder picked the **front-facing peek bird** from logo round 2 as the in-app buddy (the logo itself stays a
separate mark). Study it first: `design/logo-concepts/round-2/C-front-peek.html`, its generator `build_c.py`, and render
`design/logo-concepts/round-2/renders/C-front-peek.png`. Keep: round cream head, amber beak wedge turned slightly,
sand forehead cap, pointed feather-tip wings, calm closed ◡ eyes at rest / soft pills when alert, the little extras
("…" for check-in, "z" for break, a small sparkle for celebrating).
Fix its known weaknesses: the dark collar band read as a seatbelt — drop it or replace it with something subtler;
it should read as a **bird**, not a penguin/chick (the beak is the main cue). IMPORTANT: the buddy is now its **own
character on the desktop with a transparent background — no app-tile/rounded-square behind it.** You may give it a
body, feet or a perch if your direction needs it, but keep the shapes minimal (Muse / Grok-bot level of simplicity).

## Palette — Sage
bird light `#F3EEE1`, wing/cap tone `#D9CFB4`, ink `#2F4236`, beak `#E3B55B`, brand sage `#5E7F6B` (UI chips, accents),
page bg `#F6F3EA`. Flat vector, no gradients/filters (one very soft drop shadow under the bird is allowed for the
desktop mockup only).

## Animation states (engineering interface — use these names)
`idle`, `working`, `focus` (smaller, quieter, no chatter), `break`, `nudging` (gentle "still on the intro?"),
`celebrating` (step or block done).

## Deliverable (each agent)
One self-contained HTML file in `design/buddy-concepts/` (inline SVG + CSS/JS, no external libs; Google Font Inter ok):
1. **Desktop mockup** (~1280x800 frame): a generic, calm desktop with one or two placeholder windows (e.g. a document
   editor with grey text lines — no real brands, logos or product UIs). The buddy sits at its real size (roughly
   90–140 px) in your direction's position, with whatever minimal UI it needs (e.g. a small timer pill / current-step
   chip / speech bubble with the nudge text). Show it mid-`working` with a live animated idle loop.
2. **State sheet**: the six states side by side at ~160 px on transparent/page bg, each labelled with the state name
   and a one-line description of when it shows.
3. **Close-up animation** of the buddy at ~280 px cycling through the states (CSS keyframes or a small JS state
   cycler, ~3 s per state, gentle easing).
4. A short rationale paragraph and honest weaknesses at the top.

## Process
- Render and LOOK: `python "C:/Users/hhl_c/.claude/plugins/cache/logo-design-skill/logo-design/1.4.4/skills/logo-design/scripts/render_png.py" <file>.html -o design/buddy-concepts/renders/<name>.png --width 1400 --height 2000`
  (Chrome headless, one frame). Read the PNG, fix issues, iterate at least twice. If the animation starts empty, offset
  it with a negative animation-delay so the render shows the bird.
- Only write inside `design/buddy-concepts/`. Don't touch git. Don't modify round-2 files.
- Report back: file path, render path, 3-sentence summary, honest weaknesses.
