# Design system review artifact

Open `review.html` in a browser, or run the local preview from the repository root:

```sh
node design/system/serve.cjs
```

Then open http://127.0.0.1:4318/system/review.html. The server binds only to the local computer and serves the `design/` directory. It has no write endpoints.

## Remaining decisions

Open `remaining.html` at http://127.0.0.1:4318/system/remaining.html for paired comparisons of primary buttons, peek frequency, character motion and Round Buddy versus Puff. The shared motion player supports idle, focus, thinking, completion and reduced motion. Nothing is preselected; discuss selections in chat to record them.

`choices.selected.json` records the founder's selected foundations: 16 px body text, 24 px card padding, 8 / 14 / 20 px corners and clay error colours. The original review board defaults to those values. PR #398 merged the initial brand assets; these system artifacts are follow-up work.

Rebuild the remaining-decisions page with `node design/system/build-remaining.cjs`. Its character comparisons reuse the original SVG studies in the current palette.

All four remaining choices were selected by the founder on 2026-10-04: balanced primary actions, one featured peek per view, quiet idle breathing and the round corner sitter replacing Puff. These are recorded alongside the foundations in `choices.selected.json`; the comparison board remains an interactive exploration rather than a persistence mechanism.

## Explore

- Overview: agreed brand decisions beside the proposed system.
- Foundations: type scale, spacing, corners and semantic colour roles.
- Components: buttons, field validation, tasks, feedback and a dialog.
- Behaviour: voice, character frequency, motion and accessibility.
- Confirm: side-by-side examples of both body sizes, padding sizes, corner sets and error treatments. Each pair isolates one variable and stays visible after selection; the combined preview reflects all current choices.

Switch light and dark mode at the top. Preview settings are temporary and do not save or approve decisions. Discuss choices in chat before updating the handoff.

`SPEC.proposed.md` contains the full proposal, and `tokens.proposed.json` contains the values. The cream wordmark SVG is a review-only dark-theme variant; it does not complete the final logo export kit.

Browser verification covered the theme switch, all four live options, inline validation and recovery, dialog Escape and focus return, loading feedback, reduced motion, local font loading and console errors. The board was rendered and visually inspected. App code was not changed.
