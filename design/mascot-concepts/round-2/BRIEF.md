# Plover buddy: round 2 design brief

Source of truth: `docs/superpowers/specs/2026-10-02-desktop-buddy-pivot-spec.md`
(read §1–§4). The old product (progress tracking) is frozen. Ignore it.

## What Plover is now
Plover is a small, cute character that lives on your desktop and keeps you company
while you work. You tell it what you're about to do. It breaks the task into steps,
runs a focus timer (Pomodoro-style work/break), gives gentle "lock in" reminders,
and checks in on how it's going. It sells **company and momentum**: a little work
buddy that feels alive on your laptop. It is not a dashboard, a planner, or a
monitor. The audience is people who respond to Finch, Duolingo's owl, or Forest,
but on the desktop, during long self-directed work.

## Hard rules for this round
- **Do NOT use or reference `plover-logo.png` or any round-1 concept.** The brand
  identity is open and may change completely. Start from a blank page.
- It should be **bird-like** (the product is called Plover), but how literal is
  your call. "Suggests a bird through shape or motion" is fine.
- **Minimalist and cute.** A few simple shapes, expressive through *motion*, not
  detail. The founders' reference points are ChatGPT's voice-mode dots, Meta's
  Muse, and Grok's companion bot. Take the spirit (simple forms, smooth, alive);
  copy nothing. It must be an original character.
- **Tone:** encouraging and non-judgmental. Nudges are a gentle "come back",
  never guilt, never red alarms.

## Where it lives
A small frameless, always-on-top window, roughly 64–140px. It can be dragged,
minimized, or dismissed, and must never block the work. It must also stay
readable when shrunk to ~40px (minimized).

## Animation states (the engineering interface; show every one)
| State | Moment |
|---|---|
| `idle` | No session running. Alive but quiet. |
| `listening` | User is typing a task / Gemini is breaking it into steps ("thinking"). |
| `working` | Focus timer running. "Working with you": steady, calm, not distracting. |
| `break` | Break between work cycles. Relaxed, resting. |
| `checking-in` | Asks "how's it going?" and wants the user's attention politely. |
| `nudging` | Lock-in reminder: gently pulls you back to the task. |
| `celebrating` | Step done / session done. A small joy moment. |
| `sleeping` | Minimized / dismissed / off. |

Also show at least one **transition** (e.g. working → celebrating → break) so
smoothness is judged in motion, not just as loops.

## Deliverable (per agent)
One self-contained HTML file in `design/mascot-concepts/round-2/` containing:
- At the top: a 3–5 sentence rationale, the palette hex codes, and a note on how
  you'd build it for real (CSS/SVG, Lottie, or Rive) and why.
- **3 variants** of your direction. Each has a state switcher and renders at
  ~140px and ~40px on light and dark backgrounds.
- **An in-context mock**: a fake laptop desktop (a blurred doc/editor window)
  with the buddy in its corner, showing a timer ring or readout and a
  check-in speech bubble ("How's step 2 going?" with Done / Still on it / Stuck
  buttons). Let the viewer click through a mini session flow.
- Respect `prefers-reduced-motion`, plus a toggle to preview it.
- Inline SVG/CSS/vanilla JS only, no external deps or network.
- Write ONLY inside `design/mascot-concepts/round-2/`. Touch nothing else.
- **Verify it renders.** Open your file with the built-in browser tools
  (`mcp__Claude_Browser__navigate` to `file:///D:/GitHub/Plover/design/mascot-concepts/round-2/<file>`
  then screenshot), and fix any clipping, overlap, or broken states you see.
  Other agents share the browser pane, so stay on your own tab/file.
