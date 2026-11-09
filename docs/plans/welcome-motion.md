# Welcome page: first-person copy, motion and the pin moment

Agreed direction: concept D in the motion prototype
(https://claude.ai/artifact/8nCcFRvciCgfc8gySPGYTY). The six steps stay the
same; this changes how they read and move. Three stacked PRs, one at a time,
each green on `pnpm typecheck && pnpm lint && pnpm test`.

## PR 1: first-person copy and a shortcut that registers

Chrome 156 refuses `Alt+Shift+P` for `_execute_action` (it registers as an
empty shortcut; see the `plover-extension-wxt` skill), so the shortcut moves to
`Alt+Shift+O`, which registers in a clean profile.

- `extension/manifest.config.ts`: `suggested_key.default` → `Alt+Shift+O`.
- `extension/tests/manifest.test.ts`: expect `Alt+Shift+O`.
- `extension/src/entrypoints/options/main.tsx`: shortcut text.
- `extension/src/entrypoints/welcome/steps.tsx` copy, all in Plover's voice:
  - Hello body: "I'm a small work buddy. I help you start, one step at a time."
  - Sign in: heading "First, let's sign you in"; body "Sign in so I can save
    your tasks and suggest steps. I'll move on by myself once you're in."
  - Site access: before the button, a note: Chrome will say I can "read and
    change" your sites. That's its standard warning for anything that draws on
    a page. Button "Put me on your pages". Decline note: "No problem. You can
    add me one site at a time from my popup."
  - How: heading "Here's how I'll help", body "We'll take it one small step at
    a time, together.", rows:
    1. You tell me what's on your plate — Big or fuzzy is fine. I'll break it
       into small steps, and you can change any of them.
    2. We focus together — I'll start a 25-minute timer, block the sites you
       pick, and stay quiet in my corner.
    3. I'll check in — When the timer ends, I'll ask what you got done. Then we
       both take a break.
  - Pin: heading "Pin me so I'm one click away"; body "Click the puzzle piece
    in your toolbar, then the pin next to Plover."; note "Or press
    Alt+Shift+O to open me."
  - `main.tsx` privacy line: "I keep your tasks on this device."
- `docs/DESIGN.md`: §4.5 and §9.4 shortcut, §4.12 step names.

## PR 2: progress bar and a bird that reacts

- Six-segment progress bar replaces the dots; each segment fills (scaleX,
  500 ms) and the newest one pops.
- The buddy above the card is no longer remounted per step (drop its `key`);
  a wrapper plays a squash-and-hop (520 ms) on every step change.
- Buddy state: `working` (blinks) by default; `celebrating` (happy eyes, its
  own hop) for ~1.8 s on step 1 and when sign-in, site access or Calendar
  succeeds, then back to `working`. Re-trigger by changing a `key` on the
  celebration.
- The card itself does not bounce. Content keeps its directional fade, adds a
  45 ms stagger per child, and the card animates its height between steps.
- Everything stays instant under `prefers-reduced-motion`.

## PR 3: the pin moment

- Toolbar mock at the top of step 6 with the real icon
  (`public/icon/*.png`), not the buddy and an emoji.
- On arrival the buddy flies into the mock puzzle piece, a mock extensions
  menu opens, a cursor hovers the pin ("Pin" tooltip), clicks, and the icon
  lands in the toolbar slot with a pulse. "Show me again" replays it.
- Real pin detection: `chrome.action.getUserSettings()` (`isOnToolbar`) on a
  short poll or `action.onUserSettingsChanged`; when the user really pins,
  the buddy celebrates and the copy says "Found me!". Check both APIs in the
  sandbox Chrome before relying on them.
- "Start my first task" calls `chrome.action.openPopup()` and closes the tab;
  if it throws, keep today's `window.close()`.
- The mock follows Chrome's layout; copy says "extensions menu" so Edge,
  Brave and Arc users aren't misled.
- `docs/DESIGN.md` §4.12 updated; delete this plan in this PR.
