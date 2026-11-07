# Renderer Page Decomposition Plan

**Goal:** Break up the four oversized renderer page components — `Settings.tsx`
(920 lines), `Onboarding.tsx` (917 lines), `Home.tsx` (489 lines),
`GoalsList.tsx` (423 lines) — into smaller, single-concern files, so the
codebase stays easy to extend as more features land. **Pure reorganization —
no behavior changes.** Every toggle, handler, and screen must work exactly
as before.

**Pattern to mirror:** `app/src/renderer/overlay/steps/` already does this
correctly for the overlay flow — each step is its own folder
(`StepBreakdown/StepBreakdown.tsx` + co-located `StepBreakdown.test.tsx`).
Follow that same folder-per-piece shape here.

## Global constraints

- No logic changes — this is strictly moving JSX/handlers/state into new
  files and importing them back. If something looks buggy while you're in
  there, leave a one-line note in your final report instead of fixing it
  inline.
- Every extracted component/hook file gets a co-located `.test.tsx`/`.test.ts`
  only if the original had test coverage for that behavior — see Task 4.
  Don't invent new test scaffolding beyond preserving what exists in
  `Settings.test.tsx` and `Onboarding.test.tsx` today (update their imports/
  queries as needed after the split, don't reduce their coverage).
- TypeScript strict mode stays on (`noUncheckedIndexedAccess`,
  `noImplicitOverride`, `noFallthroughCasesInSwitch`) — don't loosen anything
  in `tsconfig.json` to make the split easier.
- No comments explaining WHAT the code does. Only keep a comment if it
  explains a non-obvious WHY (most of the `{/* Step N */}` dividers in
  `Onboarding.tsx` can just disappear once each step is its own file).
- Work directly on the current branch (`main`) in this checkout — do not
  create a worktree or a new branch.

---

## Task 1: Split `Onboarding.tsx` into per-step files

**Current shape:** `app/src/renderer/main/pages/Onboarding/Onboarding.tsx`
(917 lines) is a single component with `const [step, setStep] = useState(0)`
and inline JSX blocks gated by `step === N`, at lines: step 0 (Welcome,
~152-205), step 1 (use-case selection, ~206-263), step 2 (the Promise
screen, ~264-330), step 3 (grant access, ~331-402), step 4 (setup complete,
~403-433), step 5 (guided task carousel, ~434-830 — by far the largest, has
its own internal sub-sections for the label capsule, carousel arrows, mockup
window, dot indicators, and back/continue nav), step 9 (trial close,
~832-917).

**Target shape**, mirroring `overlay/steps/`:
```
app/src/renderer/main/pages/Onboarding/
  Onboarding.tsx              # thin shell: step state + switch over step components
  steps/
    StepWelcome/StepWelcome.tsx
    StepUseCase/StepUseCase.tsx
    StepPromise/StepPromise.tsx
    StepGrantAccess/StepGrantAccess.tsx
    StepSetupComplete/StepSetupComplete.tsx
    StepTaskCarousel/StepTaskCarousel.tsx
    StepTrialClose/StepTrialClose.tsx
```
(Use whatever step names best match the content once you're reading the
actual JSX — the above are working names based on the comment dividers.)

Each step component receives whatever slice of state/handlers it needs as
props from `Onboarding.tsx` (which keeps owning `step`, `setStep`, and any
state genuinely shared across steps, e.g. the use-case selection carried
from step 1 into later steps). If step 5's carousel has meaningfully
independent sub-pieces (e.g. the mockup window renderer), you may split
those into their own files under `StepTaskCarousel/` too — use judgment,
don't force it.

Update `app/src/renderer/main/pages/Onboarding/Onboarding.test.tsx` imports/
queries as needed after the split.

---

## Task 2: Split `Settings.tsx` into per-concern sections

**Current shape:** `app/src/renderer/main/pages/Settings/Settings.tsx`
(920 lines) has 11 handlers and ~10 `useState` hooks covering four distinct
concerns:
- **Account**: `googleConnected`, `authStatus`, `handleConnectGoogle`,
  `handlePloverAccountToggle`
- **Appearance**: `theme`, `handleThemeChange`, `companionMode`,
  `handleCompanionModeChange`, `handleShowCompanion`
- **Activity tracking**: `activitySettings`, `screenPermission`,
  `activityMessage`, `handleScreenCaptureToggle`, `handleWindowTrackingToggle`
- **Scheduling**: `workingHours`, `horizonDays`, `pauseScheduling`,
  `handleWorkingHoursChange`, `handleHorizonChange`,
  `handlePauseSchedulingToggle`

`saveStatus` spans all four (a single save affordance for the whole page) —
keep that in the shell component.

**Target shape:**
```
app/src/renderer/main/pages/Settings/
  Settings.tsx                 # thin shell: layout + saveStatus + composes sections
  sections/
    AccountSection/AccountSection.tsx
    AppearanceSection/AppearanceSection.tsx
    ActivityTrackingSection/ActivityTrackingSection.tsx
    SchedulingSection/SchedulingSection.tsx
```

If a section's state is simple enough to prop-drill from `Settings.tsx`,
do that (matches the existing pattern elsewhere in the renderer — no new
context/hook machinery unless genuinely needed). Only reach for a shared
hook (e.g. `useSettings()`) if prop-drilling would mean passing more than
~6-7 props into a single section — use judgment.

Update `app/src/renderer/main/pages/Settings/Settings.test.tsx` imports/
queries as needed after the split.

---

## Task 3: Extract shared goals+tasks data hook from `Home.tsx` and `GoalsList.tsx`

`app/src/renderer/main/pages/Home/Home.tsx` (489 lines) and
`app/src/renderer/main/pages/GoalsList/GoalsList.tsx` (423 lines) duplicate
the same goals+tasks fetch/expand/collapse/toggle/delete logic. Extract the
shared data-fetching and mutation logic into:

```
app/src/renderer/main/hooks/useGoalsAndTasks.ts
```

Both pages then consume this hook instead of duplicating the fetch/mutation
logic. Additionally, split out of `Home.tsx`:
```
app/src/renderer/main/pages/Home/
  Home.tsx
  SetupModal/SetupModal.tsx
  GoalCard/GoalCard.tsx
```
Keep `GoalsList.tsx`'s own row/list rendering where it is (it renders goals
differently from `Home.tsx`'s cards) — only the data layer is shared.

---

## Task 4: Verification (you own this before reporting done)

- [ ] `pnpm --filter ./app typecheck` — clean.
- [ ] `pnpm --filter ./app lint` — clean.
- [ ] `pnpm --filter ./app run test` — all tests green, including the updated
      `Settings.test.tsx` / `Onboarding.test.tsx`.
- [ ] Grep for any remaining import of the old flat paths
      (`pages/Settings/Settings.tsx` handlers, `pages/Onboarding/Onboarding.tsx`
      step JSX) to confirm nothing references removed code.
- [ ] Report back a summary: files created, files deleted/shrunk with new
      line counts, and any judgment calls you made (e.g. where you used a
      shared hook vs. prop-drilling, how you named carousel sub-pieces).

Note: actually launching the app (`pnpm dev`) and clicking through each
screen is the orchestrator's job after this lands, not yours — but flag in
your report if you spot anything during the split that looks like it could
change runtime behavior, so it can be checked.
