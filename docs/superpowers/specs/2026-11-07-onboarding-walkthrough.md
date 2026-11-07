# Onboarding as a step-by-step walkthrough

**Status:** Design only, not implemented. **Date:** 2026-11-07.
**Extends:** [pivot spec](2026-10-02-desktop-buddy-pivot-spec.md) §6.1 (site access is optional; the welcome page asks for it).
**Implementation plan:** [docs/plans/onboarding-steps.md](../../plans/onboarding-steps.md) (file-by-file, ready for an implementation agent).

## 1. Problem

The welcome page (`extension/src/entrypoints/welcome/`, opened on install) is one long scrolling page with six plain sections: sign in, what Plover does, site access, Google Calendar, pin Plover, privacy. It works, but:

- It reads like a settings page, not a first meeting with a buddy. Nothing moves and nothing reacts.
- The most important action, **putting Plover on your pages**, sits halfway down with no picture of what it means. Users who miss it get the popup's per-site link instead, then Chrome asks for every site one by one (Chrome's extension page has no "all sites" option for optional permissions).
- There's no sense of progress or of being done.

## 2. Goal

A short walkthrough, one idea per screen, that ends with Plover on the user's pages, signed in, and pinned. Same page and URL (`/welcome.html`), no new permissions, no new dependencies, no worker changes.

## 3. Design

Six steps. Each is a centred card (max-width 480px) with the buddy above it and progress dots at the top.

| # | Step | Buddy | What it asks |
|---|---|---|---|
| 1 | **Hello.** "Hi, I'm Plover." A small work buddy that helps you start, one step at a time. | celebrating | "Let's get set up" |
| 2 | **Sign in.** Existing `SignIn` component; "You're signed in." if already signed in. Advances on its own after sign-in. | idle | sign in / "Continue" |
| 3 | **Meet your buddy.** "I'll sit in the corner of your pages. I only draw myself. I never read the page or your history." A browser mock; the buddy pops into its corner when access is granted. | working | "Put Plover on my pages" (requests all sites) / "Not now" |
| 4 | **How a session goes.** Three rows that slide in one after another: Break it down → Focus for a block → Tick off a step. | working | "Continue" |
| 5 | **Calendar (optional).** "Want a heads-up before meetings?" | idle | "Connect Google Calendar" / "Skip" |
| 6 | **You're all set.** A toolbar mock with a pulsing ring around the pinned buddy; "Or press Alt+Shift+P". Privacy line + policy link under the card. | celebrating | "Start my first task" (closes the tab) |

**Motion:** content slides 24px and fades in (280ms), direction-aware for Back; the buddy bounces slightly on each step; the step-4 rows stagger by 120ms; the buddy in the browser mock pops in with a slight overshoot. Everything is instant under `prefers-reduced-motion`.

**Navigation and access:** progress dots (current = wide pill), a Back text button on steps 2–6, no jumping ahead. Focus moves to each new step's heading. Only existing tokens and button classes, so dark mode keeps working.

Exact copy, sizes, easing curves and the mocks' construction are in the implementation plan.

## 4. Not in scope

- Remembering the step across reloads (the page is shown once, on install).
- Asking for all-sites access at install time (stays optional, per spec §6.1).
- An "Allow on all sites" button in the popup and Settings. Worth doing separately so users who skip step 3 aren't stuck approving sites one at a time.
- New art: the buddy is the existing placeholder with its existing animation states.

## 5. Testing

- `pnpm typecheck && pnpm lint && pnpm test` green (UI scaffolding, so no new unit tests required).
- Manual: load the built extension, open `chrome-extension://<id>/welcome.html`, walk all six steps forward and back, signed out and signed in, granting and declining site access; repeat with the OS "reduce motion" setting on and in dark mode.
- Headless check: a Playwright run against a copy of `.output/chrome-mv3` (see the `plover-extension-wxt` skill for the `<all_urls>` test-copy note) that screenshots each step.

## 6. Delivery

One PR (a single entrypoint, `extension/src/entrypoints/welcome/*`), with before/after screenshots of each step.
