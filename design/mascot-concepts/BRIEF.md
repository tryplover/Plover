# Plover mascot — shared design brief

## Product context
Plover is a local-first desktop companion (Electron, Mac first) for knowledge workers
and students. You give it a vague goal, it breaks the goal into subtasks, and it
quietly watches your work to show **visible progress**. Its pitch is *momentum, not
recall*: the research behind the pivot (`reports/Progress visibility motivation evidence.md`)
found that making progress visible raises goal attainment (d ≈ 0.40, and more when
the progress is physically recorded). Think "a fitness ring for knowledge work."
The target user is a solo knowledge worker who can't tell whether their work is
actually going anywhere.

The character will live mostly in a **small always-on-top overlay** (roughly 32–96px),
plus larger moments in the app (onboarding, empty states, celebrations). It has to
read clearly at 32px.

Privacy is core to the brand: the user should always be able to tell when Plover
is watching and when it is paused. The character should feel calm and trustworthy,
never like surveillance.

## Existing brand
`plover-logo.png` (repo root) is a flat silhouette of a ringed plover in warm brown
`#7A4718` on white. It has a round head, a white face patch with an eye ring, a
short wedge beak, a dark back, a white belly, and thin legs. Real plovers are small
shorebirds that run in quick bursts and stop dead. They bob, have a black
breast-band "collar", and leave footprints along the shoreline.

## Aesthetic direction
Minimalist, a few shapes, a lot of personality from motion rather than detail. The
reference is the *spirit* of tiny expressive UI characters: a robot face made of
two dots, a small abstract glyph that "thinks" by morphing, a calm meditative
breathing animation. **Do not copy or imitate any existing product's character or
brand.** This must be an original bird.

## Required animation states (each concept must show all of these)
1. **Idle**: alive but quiet (blink, bob, breathe)
2. **Working / on track**: steady, focused
3. **Progress moment**: a small celebration when a subtask advances
4. **Gentle nudge / off track**: gets attention without nagging or guilt
5. **Paused / not watching**: obviously "eyes off" for privacy

## Deliverable (per agent)
- One self-contained HTML file: inline SVG + CSS (+ minimal vanilla JS if needed),
  no external deps, no network. Show 2–3 variants of your direction. Render each
  variant at large size (~200px) AND at 32px side by side. Give each one a state
  switcher, or show all states on a grid.
- Respect `prefers-reduced-motion`.
- Light and dark background swatches so the character is checked on both.
- At the top of the page: a 3–5 sentence rationale, plus the palette hex codes.
- Write ONLY inside `design/mascot-concepts/`. Do not touch any other file in the repo.
