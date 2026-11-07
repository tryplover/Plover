# Multi-step onboarding Plan

> **For agentic workers:** implement in order. Run every command from the repo root. Don't commit.

**Goal:** Replace the single scrolling welcome page (`extension/src/entrypoints/welcome/`) with a short, friendly, step-by-step walkthrough: one idea per screen, a progress indicator, smooth transitions, and the buddy reacting on each step. Same page and URL (`/welcome.html`, opened on install by `openWelcome()`), no new permissions, no new dependencies, no worker changes.

**Decisions (already made):**
- **Six steps**, in this order. Each is a card centred on the page (max-width 480px), with the buddy above the card.
  1. **Hello** — buddy `celebrating` (waves/hops). Eyebrow "WELCOME", heading "Hi, I'm Plover.", body "A small work buddy that helps you start, one step at a time." Primary button "Let's get set up".
  2. **Sign in** — buddy `idle`. Heading "First, sign in". Body "Your tasks stay on this device. Signing in lets Plover suggest steps for you." Renders the existing `<SignIn />` when `local.needsSignIn`; otherwise a line "You're signed in." with a tick and the primary button "Continue". When the user signs in while on this step, advance automatically after 600ms.
  3. **Meet your buddy (site access)** — buddy `working`. Heading "I'll sit in the corner of your pages". Body "I only draw myself. I never read the page or your history." Shows the **browser mock** (below). Primary button "Put Plover on my pages" → `browser.permissions.request({ origins: [ALL_SITES] })`; on success the mock's buddy pops in (scale animation) and the button becomes "Continue". Secondary text button "Not now" advances; under it, after a decline, the existing note "No problem. The Plover popup can add it one site at a time." If already granted on load: show the buddy in the mock and "Continue".
  4. **How a session goes** — buddy `working`. Heading "Here's how it works". Three rows that fade/slide in one after another (120ms stagger), each with a number badge, a title and one line:
     - "Break it down" — "Tell me the task. I'll suggest small steps you can edit."
     - "Focus for a block" — "Start a 25-minute timer. Focus mode blocks your distracting sites."
     - "Tick off a step" — "When the block ends, tell me what you finished. Then take a break."
     Primary "Continue".
  5. **Calendar (optional)** — buddy `idle`. Heading "Want a heads-up before meetings?" Body "Connect Google Calendar and I'll warn you if a focus block would run into an event. I only read your calendar." Primary "Connect Google Calendar" (existing `calendar/connect` command; disabled with "Sign in first." if `needsSignIn`; shows error with `role="alert"`); when `local.calendarConnected`, shows "Calendar connected." and the primary becomes "Continue". Text button "Skip".
  6. **Pin Plover** — buddy `celebrating`. Heading "You're all set". Body "Pin me to your toolbar so I'm one click away." Shows the **toolbar mock** (below). Small line "Or press Alt+Shift+P to open me." Primary "Start my first task" → `window.close()`. Under the card: privacy line "Your tasks stay on this device." + link "Privacy policy" (`PRIVACY_POLICY_URL`, `target="_blank" rel="noreferrer"`).
- **Navigation:** progress dots at the top (6 dots; current one is a wider pill in `--color-action-brand-bg`, done ones filled, upcoming ones outlined; `aria-label="Step N of 6"` on the container, dots are `aria-hidden`). A "Back" text button at the card's bottom-left on steps 2–6. No skipping ahead via the dots. Step state is plain `useState` (starting at 0); it is not persisted.
- **Transitions:** the card's content is keyed by step; entering content animates from `opacity:0; translateX(24px)` (or `-24px` when going back) to rest, 280ms `cubic-bezier(.2,.8,.2,1)`. The buddy above the card animates `translateY(-6px)` then back (a small bounce, 320ms) on every step change. Under `@media (prefers-reduced-motion: reduce)` all of these become instant (no transforms, no transitions).
- **Focus management:** on step change, move focus to the new step's heading (`tabIndex={-1}`, `ref.focus({ preventScroll: true })`) so keyboard and screen-reader users land on it.
- **Look:** page background `--color-bg-page`; card `--color-bg-surface`, `--radius-panel`, soft shadow `0 16px 40px -12px rgba(36,51,41,.18)`, padding 32px (20px under 480px viewport width). Use existing classes: `.plover-btn-brand` (primary), `.plover-btn-text` (secondary/back), `.plover-eyebrow`, `.plover-heading`. Body text `--color-text-secondary`. Buddy above the card: 120×131px.

## Mocks (pure CSS/JSX, no images)

**Browser mock** (step 3): a 360×200 rounded rectangle (`--radius-card`, border `1px solid var(--color-border-decorative)`, background `--color-bg-quiet`) with a 28px top bar holding three 8px circles and a pill "address bar"; inside, three grey placeholder lines (page content). Bottom-right corner: the `<Buddy state="working" />` at 48×52px, shown only when access is granted, animating in with `scale(.4)→scale(1)` + fade, 360ms, `cubic-bezier(.34,1.56,.64,1)` (slight overshoot). Scale the mock to 100% width on narrow screens (`max-width: 100%`, `aspect-ratio: 9 / 5`).

**Toolbar mock** (step 6): a 320×44 pill-ish bar (`--color-bg-quiet`) with a fake address field on the left and, on the right, a puzzle-piece glyph (use the text "🧩" with `aria-hidden`) and a 24px rounded square holding a mini `<Buddy state="idle" />`. A "pin" highlight ring pulses around the buddy square (`box-shadow` keyframe, 1.6s, infinite; none under reduced motion).

## Files

- **Rewrite** `extension/src/entrypoints/welcome/main.tsx`: a `Welcome` component holding `step` and `direction`, rendering `<Progress>`, the buddy, and the card with the current step component. Keep the existing `SiteAccess` permission logic (the `permissions.contains` + `onAdded`/`onRemoved` listener effect) and `CalendarConnect` logic, adapted into the step components. Keep `applyStoredTheme()` and the `useExtensionState()` `ready` guard. Steps can be small functions in the same file; split into `welcome/steps.tsx` only if `main.tsx` passes ~250 lines.
- **Rewrite** `extension/src/entrypoints/welcome/welcome.css` for the layout, progress dots, card, transitions, mocks and reduced-motion rules. Use only the tokens listed above (they exist in `src/ui/tokens.css` and handle dark mode).
- `extension/src/entrypoints/welcome/index.html`: keep as is unless the title needs to be "Welcome to Plover".
- Don't touch the worker, `SignIn`, `Buddy`, or shared code. If `<Buddy>` needs a size, wrap it in a sized div like the current `.welcome-buddy` does (`.plover-buddy { width:100%; height:100%; cursor:default }`).

## Verification
- [ ] `pnpm typecheck && pnpm lint && pnpm test` green.
- [ ] `git diff --stat` shows only `extension/src/entrypoints/welcome/*` (and this plan).
