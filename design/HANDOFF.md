# Plover brand and logo: handoff (2026-10-04)

Work so far was done with the `logo-design:logo-design` skill in one long session. Everything lives under `design/`. The founder wants to be consulted at every step: show options, wait for a pick, then build.

## Locked decisions

| Area | Decision | File |
|---|---|---|
| Logo symbol | **Calm side peek on Sage**: cream bird head peeking in from bottom-right, closed ◡ eye, amber beak pointing left, one sand wing tip | `design/logo-concepts/final/plover-peek-sage.svg` (+ `.png`) |
| Brand idea | **"Quiet company"**: a small ground bird that stays near you and quietly observes; it doesn't flutter off | `design/brand/brand-direction.html` |
| Palette | Sage `#5E7F6B`, Cream `#F3EEE1` (our "white"), Ink `#2F4236` (our "black"), Sand `#D9CFB4`. **No pure white or black.** | same |
| Dark mode | **Option A accepted as the starting treatment on 2026-10-04**: Deep ink `#243329` page backgrounds, Ink `#2F4236` cards, Cream primary text, Sand secondary text, Sage actions. Deep ink is a derived dark-mode tone; the four core brand colours remain unchanged | `design/brand/dark-mode-compare.html` (+ `renders/dark-mode-compare.png`) |
| Beak amber | `#E3B55B` is used **only for the bird's beak**, never in UI, text or graphics | same |
| Contrast rules | Ink on cream 9.3:1 (body text). Cream on sage 3.8:1 (large/bold only). Sage text on cream 3.8:1 (headings only). Ink on sage 2.4:1 (never text) | same |
| Selected system foundations | **16 px body text, 24 px card padding, quieter 8 / 14 / 20 px corners, clay error colours** (#9A453C light / #E7B6AE dark). Captured from the founder's selections on 2026-10-04; component and character selections are recorded below | `design/system/choices.selected.json` |
| Shape | Soft, round corners everywhere | — |
| Loader | The **whole bird** (head + beak) blinking/bobbing, only when Plover is "thinking" (e.g. breaking a task into steps) | `design/brand/loader-test.html` (variant B) |
| Done mark | A **normal check** in a sage circle | same |
| Closed eye as a standalone symbol | **Parked, not rejected.** Reads as a generic smiley on its own | `design/brand/PARKED.md` |
| Voice | Default **calm coach** ("One step at a time." / "Still on the intro? No rush."). Customisable voices = open item for later | `brand-direction.html` |
| Type | **Lowercase "plover"**. **Nunito 700** for the logo wordmark only, **Lexend** for all other text. Founder selected 700 over 800 on 2026-10-04 | `design/brand/type-mix.html` |
| Buddy (in-app character) | **Round corner sitter**: one round ball body, short sand cap, tiny feet, feather-tip wings pointing **up** (it waves/cheers with them), slight head turn toward the work. Six states: idle, working, focus, break, nudging, celebrating. Not penguin/owl-like | `design/buddy-concepts/round-2/round-buddy.html`, `build_round.py` |

| Primary actions | **Balanced**: compact Ink/Cream buttons; Sage reserved for larger brand actions | `design/system/choices.selected.json` |
| Peek frequency | **One featured peek per view**, with reserved space and clear task controls | same |
| Character motion | **Quiet idle breathing**, static focus, whole-bird thinking and one small completion hop; reduced motion stays static | same |
| Desktop buddy | **Round corner sitter replaces Puff**, selected on 2026-10-04 | same |

## Current priority

The founder completed both review boards on 2026-10-04. All eight offered decisions are recorded in `design/system/choices.selected.json`: 16 px body, 24 px padding, 8 / 14 / 20 px corners, clay errors, balanced primary buttons, one featured peek per view, quiet idle breathing and the round corner sitter replacing Puff. Motion stays static during focus, uses a whole-bird thinking indicator and a single small completion hop; reduced motion stays static with text status. The interactive comparisons are `design/system/review.html` and `design/system/remaining.html`. Other unreviewed specification details remain proposed. Next work is the simplified 16 px favicon and export kit, with visual review before locking new artwork.

## Remaining items after system review

1. **Review wordmark lockups:** drafted on 2026-10-04 with outlined Nunito 700 letters and optical spacing. Horizontal, stacked, wordmark-only and symbol-only SVGs live in `design/logo-concepts/wordmark-draft/`. See `index.html` and `preview.png`. The founder accepted these as a starting point on 2026-10-04. Proportions and gaps remain refinable.
2. **Edge/peek motif:** one featured peek per view selected on 2026-10-04. Context studies live in `design/brand/edge-motif-study.html` and `design/brand/renders/edge-motif-study.png`: light/dark landing-page heroes, a dark app empty state, and short message cards. Anchor to an edge with reserved space; keep active tasks and controls clear. A sand outline keeps the cream bird visible on cream. Individual compositions remain refinable.
3. **16 px favicon:** the side peek collapses to a blob + beak at 16 px and needs its own simplified drawing.
4. Then the rest of the kit (logo-design skill Phase 7): one-colour/reversed versions, favicon/app-icon/social set via
   `export_variants.py`, usage guide.
5. **Desktop buddy selected:** the round corner sitter replaces Puff, confirmed through the remaining-choice review on 2026-10-04. The full six-state character rig remains implementation work.

## Practical notes

- Skill scripts: `C:/Users/hhl_c/.claude/plugins/cache/logo-design-skill/logo-design/1.4.4/skills/logo-design/scripts/`
  (use `python`, not `python3`, on this machine).
- **Rendering with web fonts:** headless Chrome can't load Google Fonts here. Use the local woff2 files in
  `design/brand/fonts/` (lexend, nunito, manrope, fraunces; variable, OFL) via `@font-face`, and screenshot with
  `"/c/Program Files/Google/Chrome/Application/chrome.exe" --headless=new --disable-gpu --hide-scrollbars --allow-file-access-from-files --virtual-time-budget=4000 --window-size=W,H --screenshot=<abs path> file:///...`
- The browser preview pane shows `file://` pages as static snapshots (no fonts, no reliable animation); ask the founder
  to open HTML files in their own browser to see motion.
- Always render and look at work before showing it.
