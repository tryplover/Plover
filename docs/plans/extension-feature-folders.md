# Extension feature-folder reorganisation Plan

> **For agentic workers:** pure move/rename refactor + duplication cleanup. No behaviour change. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Organise `extension/src` by feature (like the old `app/src/main/<feature>/`), remove duplication, and enforce context boundaries with lint.

**Architecture:** WXT `entrypoints/` stay thin (mount/boot only). Worker infrastructure lives in `worker/`. Each feature owns its pure logic and its worker handlers in `features/<name>/`. Cross-context primitives live in `shared/`. React views live in `ui/components/` and `ui/hooks/`. Tests mirror `src/`.

**Spec:** docs/superpowers/specs/2026-10-02-desktop-buddy-pivot-spec.md §6 (extension architecture).

## Global Constraints

- Zero behaviour change: every existing test keeps passing with only import-path edits (195 tests before → ≥195 after).
- Exported names and signatures stay the same unless a duplicate is being merged (then one name wins and every caller moves).
- `worker.ts` files (anything that registers handlers/alarms or touches the queue) must never be imported by `ui/**` or by the popup/options/panel/blocked/content entrypoints — enforce with ESLint `no-restricted-imports`.
- Keep the `@/` path alias; no relative `../../` imports across top-level folders.
- No new dependencies.

## Target layout

```
extension/src/
  entrypoints/            WXT entrypoints only (unchanged paths: background.ts, content/, popup/, options/, panel/, blocked/)
  worker/                 controller.ts  queue.ts  alarms.ts  reconcile.ts  state-port.ts
  features/
    timer/                machine.ts  types.ts  worker.ts (was background/timer.ts)  badge.ts
    tasks/                decompose.ts (was lib/api/decompose.ts)  worker.ts (was background/tasks.ts)
    auth/                 supabase.ts  session.ts  worker.ts (was background/auth.ts)
    blocking/             domains.ts  rules.ts  worker.ts (was background/blocking.ts)
    focus/                worker.ts (was background/focus.ts)
    calendar/             client.ts  events.ts  worker.ts (was background/calendar.ts)
    buddy/                buddy-state.ts  visibility.ts
  shared/                 types.ts  storage.ts  messages.ts  reconnect.ts
  ui/
    components/           Panel.tsx+css  TaskBreakdown.tsx  TimerControls.tsx  CheckIn.tsx  SignIn.tsx  CalendarNext.tsx  Buddy.tsx+css
    hooks/                useExtensionState.ts  useBuddySnapshot.ts
extension/tests/          mirrors src/ (tests/worker/, tests/features/<name>/, tests/shared/, tests/manifest.test.ts)
```

Feature-specific types may move from `shared/types.ts` into `features/<name>/types.ts` only if no other feature uses them; `LocalState`/`Settings` stay in `shared/types.ts`.

## Task 1: Move files (git mv) and fix imports

- [ ] `git mv` every file per the layout (keeps history). Update all imports. Update `vitest.config.ts` coverage `include` to `src/features/**`, `src/shared/**`, `src/worker/**` (same 60% thresholds).
- [ ] Run `pnpm typecheck && pnpm lint && pnpm test` → green, same test count.
- [ ] Commit `refactor(extension): organise source by feature`.

## Task 2: Remove duplication

- [ ] Find duplicates: run `npx jscpd extension/src --min-lines 5 --reporters console` (do not add it as a dependency) and grep for repeated patterns: multiple `storage.onChanged` listeners in the worker with overlapping work, repeated "get active task / first unfinished step" logic, repeated domain-cleaning, repeated `AbortController` timeout wrappers (decompose, calendar), repeated CSS blocks across `entrypoints/*/*.css` and `ui/components/*.css`, repeated `index.html` boilerplate (leave HTML: WXT needs one per entrypoint).
- [ ] Merge each real duplicate into one owner (e.g. `shared/fetch-with-timeout.ts`, `features/tasks/active-step.ts`, one worker settings-change dispatcher in `worker/`). Three similar lines is fine — only merge logic blocks.
- [ ] Add a unit test for each newly extracted helper.
- [ ] Green; commit `refactor(extension): remove duplicated logic`.

## Task 3: Enforce boundaries + docs

- [ ] ESLint `no-restricted-imports` in `extension/eslint.config.js`: for `src/ui/**` and `src/entrypoints/{content,popup,options,panel,blocked}/**`, forbid `@/worker/*` and `@/features/*/worker`. Add a lint fixture check by running `pnpm lint` (must stay green).
- [ ] Update `CLAUDE.md` workspace layout + architecture rules, the `plover-extension-wxt` skill (any path references), and `docs/plans/chrome-extension-mvp.md` is history — leave it.
- [ ] Green + `pnpm build`; commit `chore(extension): enforce worker/ui import boundary`.

## Review Focus

1. A UI module that transitively imports a `worker.ts` (bundles worker listeners into a page) — lint rule must catch direct imports; check the built popup/panel chunks don't contain `registerHandler`.
2. Moved tests silently dropped (count must not fall).
3. Merged helpers changing timeout or error semantics (decompose 15 s / calendar 10 s must stay).
