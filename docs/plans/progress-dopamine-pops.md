# Plan: toggleable "+X%" progress pops

## Context

User wants a small dopamine hit whenever Plover's background tracking adds
progress to the task you're working on: a floating "+X%" that pops up and
fades, rather than the progress bar just silently changing width.

Confirmed with user (two rounds of clarifying questions):

1. **What "+X%" measures:** the *raw per-task increment* — the actual delta
   the inference engine just applied to that specific task's own `progress`
   field (0–100 scale), not the goal-level "N of M subtasks done" fraction.
   Nothing in the UI currently displays a task's own `progress` value at all
   (verified: `ProgressLine`/Home's percent/Companion's percent are all
   goal-level or steps-fraction, never `Task.progress`) — so this plan adds a
   small, new, persistent per-task progress readout as the anchor for the pop.
2. **Where it renders:** both Home and the Companion overlay.
3. **Must be toggleable in Settings**, default **off** — user explicitly wants
   to experiment with it before the underlying tracking accuracy improves.
   Right now, per-pass deltas from the inference engine are chunky (the user
   described current jumps as "20% or 25%"); once tracking improves they
   expect deltas to land more like "2%, 4%, 6%". This plan does not touch
   tracking accuracy — only the toggle + pop UI, wired to whatever
   `progress_delta` the inference engine already decides to apply.

## Where the data already exists (no backend changes needed)

- `Task.progress` ([shared/types.ts](../../app/src/shared/types.ts)) is
  already a 0–100 field, already present on every `Task` object returned by
  `getTasks()`/`getTasksByGoal()`, already used internally by
  `TasksRepo.incrementProgress` — just never rendered.
- Every time the inference engine (or `commit-task-matcher`) applies an
  increment, it inserts a `SummaryRow` and does
  `bus.emit('summary.created', inserted)`
  ([inference.ts:184](../../app/src/main/activity/inference/inference.ts)).
  `SummaryRow.task_id` and `SummaryRow.progress_delta` (also 0–100 scale, same
  units as `Task.progress` — **do not** divide/multiply by 100 anywhere in
  this feature) carry exactly what's needed.
- `startEventForwarding` in
  [goal-manager.ts:135](../../app/src/main/planner/goal-manager.ts) already
  re-broadcasts `summary.created` to **every** renderer window via
  `broadcast('app-event', { type: 'summary.created', payload: summary })`,
  and `broadcast` ([ipc/shared.ts](../../app/src/main/ipc/shared.ts)) sends to
  `BrowserWindow.getAllWindows()` — so both the main window (Home) and the
  Companion overlay window already receive this event today. No main-process
  changes are needed for this feature at all — it's Settings schema plumbing
  (data already flows through the existing generic key/value settings store,
  no db migration) plus renderer-only wiring.

`AIProgress.tsx` already shows the pattern for subscribing directly:
`window.api.on('app-event', (event: unknown) => { const appEvent = event as
{ type: string }; if (appEvent.type === 'summary.created') ... })`. Payload
shape when `type === 'summary.created'` is a full `SummaryRow`.

## 1. Settings schema — add `progressPopsEnabled: boolean` (default `false`)

The settings shape is duplicated across several files with no shared type
alias (existing tech debt — do not refactor it, just follow the existing
repetition). Every occurrence ends with `planner_useRecentActivityContext` as
the last field — **grep for `planner_useRecentActivityContext` across
`app/src` to find every place that needs `progressPopsEnabled: boolean;`
added right after it**:

- `app/src/main/store/repos/settings.ts`: `SettingsData` interface; inside
  `getAll()` read `const progressPopsEnabled = map.get('progressPopsEnabled')
  === 'true';` (default false, mirrors `screenCaptureEnabled`'s pattern) and
  include it in the returned object; inside `update()` add `if
  (patch.progressPopsEnabled !== undefined) { this.set('progressPopsEnabled',
  String(patch.progressPopsEnabled)); }`.
- `app/src/preload/index.ts`: two duplicated inline object-literal types
  (`getSettings`'s return type and `updateSettings`'s arg + return types) —
  add the field to all of them.
- `app/src/renderer/global.d.ts`: same duplicated shape inside `PloverAPI` —
  add the field there too.

No `db.ts` migration needed — settings are a generic key/value table already.

## 2. Settings.tsx — new toggle in the Appearance section

In [Settings.tsx](../../app/src/renderer/main/pages/Settings/Settings.tsx),
follow the exact same pattern as `theme`/`companionMode` (plain `useState`,
not part of the `ActivitySettings` blob, since this isn't an activity-tracking
knob):

- `const [progressPopsEnabled, setProgressPopsEnabled] = useState(false);`
- In `fetchSettings()`: `setProgressPopsEnabled(settings.progressPopsEnabled ??
  false);`
- Widen `triggerAutoSave`'s `Partial<{...}>` parameter type (the object type
  literal a few lines below `companionMode: 'full' | 'compact';`) to include
  `progressPopsEnabled?: boolean;`.
- Add a handler: `const handleProgressPopsToggle = () => { const next =
  !progressPopsEnabled; setProgressPopsEnabled(next); void
  triggerAutoSave({ progressPopsEnabled: next }); };`
- Add a new row in the **Appearance** card (after the existing "Companion Bar
  Visibility" row, following the same divider + flex-row + `Chip` pattern
  used for every other row in that card):
  ```tsx
  <div style={{ height: '1px', backgroundColor: 'var(--plover-border)', marginTop: '20px', marginBottom: '20px', opacity: 0.5 }} />
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
    <div>
      <p style={{ fontSize: '14px', fontWeight: 500, color: 'var(--plover-text)' }}>
        Progress pops
      </p>
      <p style={{ fontSize: '13px', color: 'var(--plover-text-muted)', marginTop: '4px' }}>
        Show a floating "+X%" when Plover adds progress to your active task in
        the background. Experimental — deltas may be chunky until tracking
        accuracy improves.
      </p>
    </div>
    <Chip selected={progressPopsEnabled} onClick={handleProgressPopsToggle}>
      {progressPopsEnabled ? 'On' : 'Off'}
    </Chip>
  </div>
  ```

Optional but nice: add one test to
[Settings.test.tsx](../../app/tests/renderer/main/pages/Settings.test.tsx)
mirroring the existing "renders the Appearance section heading and toggles
theme" test — click the new Chip and assert `updateSettings` was called with
`{ progressPopsEnabled: true }`. Not required (this repo skips TDD for UI
scaffolding) but cheap given the existing test file already covers this
section.

## 3. New shared hook: `useProgressPops`

New file `app/src/renderer/hooks/useProgressPops.ts`:

```ts
import { useEffect, useRef, useState } from 'react';

export interface ProgressPop {
  key: number;
  delta: number;
}

const POP_LIFETIME_MS = 1400;

export function useProgressPops(taskId: string | null, enabled: boolean): ProgressPop[] {
  const [pops, setPops] = useState<ProgressPop[]>([]);
  const nextKey = useRef(0);

  useEffect(() => {
    setPops([]);
    if (!enabled || !taskId) return;

    const timeouts = new Set<ReturnType<typeof setTimeout>>();

    const unsubscribe = window.api.on('app-event', (event: unknown) => {
      const appEvent = event as {
        type: string;
        payload?: { task_id?: string | null; progress_delta?: number | null };
      };
      if (appEvent.type !== 'summary.created') return;
      if (appEvent.payload?.task_id !== taskId) return;
      const delta = appEvent.payload?.progress_delta;
      if (typeof delta !== 'number' || delta <= 0) return;

      const key = nextKey.current++;
      setPops((prev) => [...prev, { key, delta }]);
      const timeoutId = setTimeout(() => {
        setPops((prev) => prev.filter((p) => p.key !== key));
        timeouts.delete(timeoutId);
      }, POP_LIFETIME_MS);
      timeouts.add(timeoutId);
    });

    return () => {
      unsubscribe();
      timeouts.forEach(clearTimeout);
    };
  }, [taskId, enabled]);

  return pops;
}
```

Notes for whoever implements this:
- Resetting `pops` to `[]` whenever `taskId`/`enabled` changes avoids stale
  pops lingering when the active task switches.
- Timeouts are tracked in a `Set` and cleared on cleanup so nothing calls
  `setState` after unmount (this repo's `plover-testing` skill flags exactly
  this class of bug for other timers/listeners in this codebase).
- `window.api.on('app-event', ...)` is the same subscription pattern already
  used directly in
  [AIProgress.tsx](../../app/src/renderer/main/pages/AIProgress/AIProgress.tsx)
  — don't route this through `useAppEvents` (that hook only forwards a fixed
  whitelist of event types and drops the payload entirely).

## 4. New shared component: `PercentPop`

New files `app/src/renderer/components/PercentPop/PercentPop.tsx` and
`PercentPop.css`:

```tsx
import { AnimatePresence, motion, ploverDuration, ploverEasing } from '../../lib/motion';
import type { ProgressPop } from '../../hooks/useProgressPops';
import './PercentPop.css';

export interface PercentPopProps {
  pops: ProgressPop[];
}

export function PercentPop({ pops }: PercentPopProps) {
  return (
    <span className="plover-percent-pop-host" aria-hidden>
      <AnimatePresence>
        {pops.map((pop) => (
          <motion.span
            key={pop.key}
            className="plover-percent-pop"
            initial={{ opacity: 0, y: 0, scale: 0.9 }}
            animate={{ opacity: 1, y: -16, scale: 1 }}
            exit={{ opacity: 0, y: -28 }}
            transition={{ duration: ploverDuration.slow, ease: ploverEasing.spring }}
          >
            +{Math.round(pop.delta)}%
          </motion.span>
        ))}
      </AnimatePresence>
    </span>
  );
}
```

`PercentPop.css`:
```css
.plover-percent-pop-host {
  position: absolute;
  top: 0;
  right: 0;
  pointer-events: none;
}

.plover-percent-pop {
  position: absolute;
  top: 0;
  right: 0;
  font-size: 11px;
  font-weight: 600;
  white-space: nowrap;
  color: var(--plover-mint);
}
```

The caller is responsible for wrapping `<PercentPop />` in a
`position: relative` element sized/positioned where the pop should anchor —
see the two integration points below. `aria-hidden` because this is a
decorative, ephemeral, non-essential-information element (the underlying
percentage number next to it already conveys the state to assistive tech).

## 5. Home integration

[Home.tsx](../../app/src/renderer/main/pages/Home/Home.tsx):

- Extend the existing `fetchData` (the `Promise.all([getGoals(), getTasks()])`
  call) to also fetch settings in parallel:
  `const [allGoals, allTasks, settings] = await Promise.all([window.api.getGoals(), window.api.getTasks(), window.api.getSettings()]);`
  and add `const [progressPopsEnabled, setProgressPopsEnabled] = useState(false);`
  set via `setProgressPopsEnabled(settings.progressPopsEnabled ?? false);`
  inside `fetchData`.
- `const pops = useProgressPops(activeTaskId, progressPopsEnabled);` — call
  at the top level of the component (hooks can't be called conditionally),
  using the `activeTaskId` variable that already exists.
- In the `activeGoalSteps.map((step) => ...)` block, the current step already
  computes `trailing={step.id === activeTaskId ? 'now' : undefined}`. Change
  this specific branch to also show the task's own raw progress and host the
  pop:
  ```tsx
  trailing={
    step.id === activeTaskId ? (
      <span className="plover-home-step-momentum">
        <span>now</span>
        <span className="plover-home-step-momentum__pct">{Math.round(step.progress)}%</span>
        {progressPopsEnabled && <PercentPop pops={pops} />}
      </span>
    ) : undefined
  }
  ```
  **Important:** `step.progress` is already 0–100 — display directly with
  `Math.round()`, do not multiply/divide by 100 (unlike the goal-level
  aggregates elsewhere in this file, e.g. `progress` in `goalCards`, which are
  0–1 fractions that get `* 100`).

[Home.css](../../app/src/renderer/main/pages/Home/Home.css): add
`.plover-home-step-momentum { position: relative; display: inline-flex;
align-items: center; gap: 6px; }` and
`.plover-home-step-momentum__pct { font-size: 11px; color:
var(--plover-text-muted); font-variant-numeric: tabular-nums; }` near the
other small-text step-related rules.

## 6. Companion integration (Expanded view only)

Scoped to `Expanded.tsx`, not `Collapsed.tsx` — the existing code comment in
[Collapsed.tsx](../../app/src/renderer/companion/Collapsed.tsx) already
documents that Collapsed is intentionally minimal and Expanded is "the only
place with the full interactive detail," so this follows that existing
convention rather than introducing a new one.

[Companion.tsx](../../app/src/renderer/companion/Companion.tsx): the existing
`useEffect` that fetches `getSettings()` (keyed on `[expanded]`, used today
for `companionMode`) already has the full settings object in scope — add
`const [progressPopsEnabled, setProgressPopsEnabled] = useState(false);` and
inside that same `.then((settings) => { ... })` callback add
`setProgressPopsEnabled(settings.progressPopsEnabled ?? false);`. Pass it down:
`<Expanded view={view} onCollapse={...} progressPopsEnabled={progressPopsEnabled} />`.

[Expanded.tsx](../../app/src/renderer/companion/Expanded.tsx):
- Add `progressPopsEnabled: boolean` to the `Props` interface.
- `const pops = useProgressPops(view.task?.id ?? null, progressPopsEnabled);`
  at the top of the component (the hook already no-ops when `taskId` is null).
- Near the title row, after the existing
  `<p className="plover-expanded__meta">Today · one-off task</p>` line, add:
  ```tsx
  {view.task && (
    <span className="plover-expanded__task-progress">
      {Math.round(view.task.progress)}%
      {progressPopsEnabled && <PercentPop pops={pops} />}
    </span>
  )}
  ```
  Same 0–100-already, no-scaling note as above applies to `view.task.progress`.

[Expanded.css](../../app/src/renderer/companion/Expanded.css): add near the
existing `.plover-expanded__meta`/`.plover-expanded__pct` rules:
```css
.plover-expanded__task-progress {
  position: relative;
  display: inline-flex;
  font-size: 11px;
  font-weight: 500;
  color: rgba(183, 228, 199, 0.9);
  margin-top: 2px;
}
```
(Matches the mint rgba already used for this same color elsewhere in the app —
Expanded.css uses hardcoded hex/rgba throughout for its dark-glass surface
rather than the `--plover-mint` CSS var Home.css uses, so mirror that existing
convention here rather than introducing a var reference into this file.)

## Explicitly out of scope

- Fixing/improving inference tracking accuracy (the "20-25% → 2-6%" framing
  in the user's ask is about *future* tracking quality, not something to
  build here).
- `Collapsed.tsx` (compact pill) — no pop or per-task percentage there.
- `GoalsList.tsx` — not mentioned by the user, not touched.
- Any live cross-window push when the setting is toggled — this follows the
  exact same "refetch settings next time this surface's own effect re-runs"
  pattern already used for `companionMode` today (no precedent in this
  codebase for pushing settings changes live into the Companion window, so
  not introducing one here).

## Verification

```
pnpm typecheck && pnpm lint && pnpm test
```
All three must be green. If the native `better-sqlite3` module is ABI-mismatched
(symptom: `was compiled against a different Node.js version` on `new
Database(':memory:')` in store/sync tests), that's almost certainly a stale
build from a concurrently-running `pnpm dev` session locking the binary — see
the `plover-testing` / `plover-native-modules` skills, not a bug in this
feature. Manual GUI verification via `pnpm dev` is unreliable in this
environment — rely on a careful diff read plus the above commands.
