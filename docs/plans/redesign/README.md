# Plover visual redesign — plan index

Source of truth for the redesign:
[`Plover — Desktop Overlay (Moodboard & UI).pdf`](../../../Plover%20—%20Desktop%20Overlay%20%28Moodboard%20%26%20UI%29.pdf)
(15 pages, lives at the repo root).

The goal is to bring the entire Electron app — both the main window and the
overlay — onto a single visual language: a near-black canvas, warm off-white
type, a single mint accent for "live" states, heavy rounded corners, soft
translucency, and a serif-numeral percentage display. State transitions
between **observing → paused → complete → can't-verify** must animate
calmly, never jarringly.

## Phase scope note

The moodboard depicts the **collapsed companion** (a persistent pill showing
"observing · Draft — methods · 65%"). The behaviour that pill describes —
live progress signals derived from window activity — is Phase 2+ in
[core-architecture.md](../../superpowers/specs/phase-1/core-architecture.md).

For Phase 1 we ship the **visual chrome and state machine** of the companion
wired to placeholder/manual data, so the surface exists when the Monitor /
Inference modules land. This is called out explicitly in the relevant PRs.

## PR sequence

Each PR below is independent enough that a fresh reviewer can accept or
reject it on its own. They are listed in the order they should land.

| #  | PR                                                          | Why this comes when it does                                                                 |
| -- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| 01 | [Design foundation](./01-design-foundation.md)              | Tokens, fonts, base CSS, motion library. Everything else depends on these.                  |
| 02 | [Component library](./02-component-library.md)              | Status Indicator, Progress Line, Button, Step Row, App Row, Chip. Built once, used everywhere. |
| 03 | [Overlay companion + state set](./03-overlay-companion.md)  | The collapsed pill, the expanded card, and the observing/paused/done/not-sure transitions.  |
| 04 | [Setup flow redesign](./04-setup-flow.md)                   | Name → Breakdown → Connect, replacing the current `QuickAdd.tsx` overlay form.              |
| 05 | [Main window redesign](./05-main-window.md)                 | Sidebar, Today, Goals, Settings — same visual language as the overlay.                      |

## Design tokens (canonical reference)

These tokens are introduced in PR-01 and consumed by every subsequent PR.
Whenever a later plan references "the spec token", this is the spec.

### Colors

| Token                       | Hex (light/dark mix) | Where it shows up                                  |
| --------------------------- | -------------------- | -------------------------------------------------- |
| `--plover-bg`               | `#0A0B0B`            | Main canvas                                        |
| `--plover-surface`          | `#141516`            | Cards / overlay body                               |
| `--plover-surface-raised`   | `#1C1E1F`            | Hover state on rows, sidebar                       |
| `--plover-border`           | `rgba(255,255,255,0.07)` | Hairlines around cards and inputs              |
| `--plover-text`             | `#F1ECDF`            | Primary text (warm off-white)                      |
| `--plover-text-muted`       | `rgba(241,236,223,0.6)` | Secondary text                                  |
| `--plover-text-dim`         | `rgba(241,236,223,0.4)` | Hints, timestamps                                |
| `--plover-mint`             | `#B7E4C7`            | "observing" dot, "now" label, Done state           |
| `--plover-mint-soft`        | `rgba(183,228,199,0.18)` | Mint backgrounds (progress fill, Done pill)    |
| `--plover-button-primary`   | `#F1ECDF`            | Primary CTA background (cream button)              |
| `--plover-button-primary-fg`| `#0A0B0B`            | Primary CTA text                                   |
| `--plover-button-secondary` | `#1F2122`            | "Back" buttons                                     |

### Type

| Token                  | Value                                            |
| ---------------------- | ------------------------------------------------ |
| `--plover-font-sans`   | `"Inter", -apple-system, BlinkMacSystemFont, ...` |
| `--plover-font-serif`  | `"Instrument Serif", "New York", Georgia, serif`  |

Serif is used **only** for the large percentage numerals (`65%`, `100%`) and
for the moodboard's "What are you working on?" / "Finish the methods
section" display headings in the centered setup window. Everything else is
Inter.

### Radius & shadow

| Token                | Value                                  |
| -------------------- | -------------------------------------- |
| `--plover-radius-sm` | `8px` (chips, small buttons)           |
| `--plover-radius-md` | `14px` (rows, app rows)                |
| `--plover-radius-lg` | `20px` (cards, overlay panels)         |
| `--plover-radius-xl` | `28px` (the collapsed companion pill)  |
| `--plover-shadow-pill` | `0 12px 36px rgba(0,0,0,0.45)`       |
| `--plover-shadow-card` | `0 24px 72px rgba(0,0,0,0.55)`       |

### Motion

| Token                       | Value                                |
| --------------------------- | ------------------------------------ |
| `--plover-easing-soft`      | `cubic-bezier(0.32, 0.72, 0.24, 1)` |
| `--plover-easing-spring`    | `cubic-bezier(0.34, 1.56, 0.64, 1)` |
| `--plover-duration-fast`    | `120ms`                              |
| `--plover-duration-normal`  | `220ms`                              |
| `--plover-duration-slow`    | `360ms`                              |

## Out of scope for this redesign

- Adding new features. The redesign replaces visual presentation only; data
  flow, IPC, and store layers are untouched.
- Cross-platform packaging (still macOS-only per Phase 1).
- The deferred "+ Add a step" reordering UX from the breakdown step
  (the moodboard hints at drag handles; we render them but defer real DnD
  to a follow-up).
- The "Deeper integrations — coming soon" row in the Connect step is a
  static label, not wired to any picker.

## Verification rule (applies to every PR)

Before the orchestrator merges a redesign PR, the following must be green
from the repo root:

```bash
pnpm typecheck && pnpm lint && pnpm test
pnpm --filter ./app run test:coverage
```

UI changes are also smoke-tested manually with `pnpm dev` — at minimum: app
launches, every sidebar tab renders, the overlay hotkey opens the overlay.
