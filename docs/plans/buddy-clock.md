# Buddy clock Plan

> **For agentic workers:** implement the steps in order. Run every command from the repo root.

**Goal:** The floating buddy on every page holds a tiny alarm clock showing the time left in the current work block or break, so you can see your timer without opening anything. Clicking the buddy still opens the panel.

**Decisions (already made):**
- The clock is a 30px round alarm clock (cream face, coloured rim, two little bells on top) **held in front of the buddy's belly**: absolutely positioned, centred, `bottom: -4px`, overlapping the 64×70 buddy, so no layout constants or panel-frame offsets change.
- It shows only while a phase runs (`phase !== "idle"`). The face shows whole minutes left (`Math.ceil(seconds / 60)`, e.g. `12`), and seconds with an `s` (`45s`) in the last minute. Rim and bells: work = `#5E7F6B` (green), break = `#E3B55B` (amber). Paused: 0.6 opacity, stops ticking.
- The worker sends only `phase`, `phaseEndsAt` and `pausedAt` to the content script (spec §6: the content script gets the minimum it needs; no task titles, no tokens). The content script ticks locally once a second; it doesn't ask the worker every second.

## Files

### `extension/src/features/buddy/buddy-state.ts`
Add to `BuddySnapshot`:
```ts
clock: { phase: TimerPhase; phaseEndsAt: number; pausedAt: number | null } | null;
```
`TimerPhase` is from `@/features/timer/types` (check the exported name there; use whatever union type `TimerState["phase"]` is if no alias exists).

### `extension/src/worker/state-port.ts`
In `snapshotAt`, set `clock: timer.phase === "idle" ? null : { phase: timer.phase, phaseEndsAt: timer.phaseEndsAt, pausedAt: timer.pausedAt }`.

### `extension/tests/worker/state-port.test.ts`
- Every existing `toEqual({...})` on a snapshot gains `clock: null`.
- New test: with `timer` = `{ phase: "work", phaseEndsAt: 1_600_000, blocksCompleted: 2, pausedAt: null }` in storage, `buildSnapshot()` returns `clock: { phase: "work", phaseEndsAt: 1_600_000, pausedAt: null }` and the JSON doesn't contain `blocksCompleted`.

### `extension/src/entrypoints/content/BuddyClock.tsx` (new)
```tsx
export function BuddyClock({ clock }: { clock: NonNullable<BuddySnapshot["clock"]> })
```
- `const [now, setNow] = useState(Date.now())`; `useEffect` that, when `clock.pausedAt === null`, runs `setInterval(() => setNow(Date.now()), 1000)` and clears it on cleanup (deps: `[clock.pausedAt]`).
- Seconds: `remainingSeconds({ ...clock, blocksCompleted: 0 }, now)` from `@/features/timer/machine` (or compute `Math.max(0, Math.ceil((clock.phaseEndsAt - (clock.pausedAt ?? now)) / 1000))` if passing a partial state doesn't type-check; don't loosen types).
- Renders `<span className={"plover-clock " + (clock.phase === "work" ? "plover-clock--work" : "plover-clock--break") + (clock.pausedAt !== null ? " plover-clock--paused" : "")} role="timer" aria-label={...}>` containing `<span className="plover-clock__bell plover-clock__bell--l" />`, `<span className="plover-clock__bell plover-clock__bell--r" />` and `<span className="plover-clock__face">{label}</span>`, where `label = seconds > 60 ? String(Math.ceil(seconds / 60)) : `${seconds}s``. `aria-label` uses `formatClock(seconds)`: `"Focus block, 12:34 left"` / `"Break, 4:10 left"`, plus `", paused"` when paused.
- `formatClock` is exported from `@/ui/components/TimerControls`; importing it is allowed (it's not a worker module).

### `extension/src/entrypoints/content/BuddyView.tsx`
Wrap the existing `<Buddy state={snap.buddyState} />` so the clock overlays it:
```tsx
<div className="plover-buddy-figure">
  <Buddy state={snap.buddyState} />
  {snap.clock && !drag && <BuddyClock clock={snap.clock} />}
</div>
```
(inside the existing pointer-handler div). Nothing else changes.

### `extension/src/entrypoints/content/buddy.css`
```css
.plover-buddy-figure { position: relative; }
.plover-clock {
  --rim: #5e7f6b;
  position: absolute; left: 50%; bottom: 4px; transform: translateX(-50%) rotate(-6deg);
  width: 30px; height: 30px; pointer-events: none;
}
.plover-clock--break { --rim: #e3b55b; }
.plover-clock--paused { opacity: 0.6; }
.plover-clock__face {
  position: absolute; inset: 0; box-sizing: border-box;
  display: flex; align-items: center; justify-content: center;
  border: 3px solid var(--rim); border-radius: 50%;
  background: #fffdf9; color: #2f4236;
  font: 700 11px/1 system-ui, sans-serif; font-variant-numeric: tabular-nums;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.2);
}
.plover-clock__bell {
  position: absolute; top: -3px; width: 9px; height: 7px;
  border-radius: 9px 9px 2px 2px; background: var(--rim);
}
.plover-clock__bell--l { left: 1px; transform: rotate(-30deg); }
.plover-clock__bell--r { right: 1px; transform: rotate(30deg); }
```
`pointer-events: none` keeps drag and click on the buddy working through the clock.

## Verification
- [ ] `pnpm typecheck && pnpm lint && pnpm test` green.
- [ ] `git diff --stat` shows only the files above plus this plan.
