# MVP Pomodoro Timer (M2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the headless Pomodoro timer for the buddy: a pure work / short break / long break state machine, completed work blocks stored in `sessions`, clamped timer settings, a ticking `TimerService` that emits bus events, and the IPC surface the buddy UI will call.

**Architecture:** A pure state machine in `app/src/main/timer/machine.ts` takes `nowMs` as an argument and returns `{ state, events }`, so all behaviour is unit-tested without fake timers. `TimerService` owns the 1 s interval, the clock, session persistence, and bus events. `ipc/timer.ts` wires the service to Electron IPC. No renderer work in this plan.

**Tech Stack:** TypeScript (strict), better-sqlite3, Electron IPC, vitest. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-10-02-desktop-buddy-pivot-spec.md` (v2, §4.2 Pomodoro timer, §6 Store and "New pieces"). Roadmap: `docs/plans/mvp-five-features-roadmap.md` milestone M2, PRs 1-3. M2 PR 4 (buddy UI + check-in) is deliberately not in this plan: it needs M1's buddy shell, which is not on main yet.

## Global Constraints

- Spec §4.2: default **25 min work / 5 min short break / 15 min long break after every 4 work blocks**; all lengths configurable. Start, pause, skip, stop.
- Spec §4.2: completed sessions are stored locally in the `sessions` table. No stats UI.
- Spec §5 non-goals: no AI progress tracking, no screen capture, no auto-scheduling. The timer must not call a model.
- Frozen modules: do not import from `app/src/main/activity/`, `app/src/main/sync/`, `app/src/main/planner/schedule.ts`, or the Today/Goals renderer views.
- Architecture rules (`CLAUDE.md`): modules talk via the event bus and typed Store repos; no raw SQLite outside the Store.
- TypeScript strict with `noUncheckedIndexedAccess`, `noImplicitOverride`, `noFallthroughCasesInSwitch`; do not loosen. No comments unless the WHY is non-obvious. No new deps.
- Use pnpm with the global binary: `export PATH=/Users/liyu.xiao/Library/pnpm:$PATH` (`plover-pnpm-workspace` skill). Per-file tests: `pnpm --filter ./app exec vitest run <path>`. Final gate from repo root: `pnpm typecheck && pnpm lint && pnpm test`.
- Commit messages end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. Commits are SSH-signed through 1Password; on "failed to fill whole buffer" retry the same commit, never pass `--no-gpg-sign`.

## Assumptions (spec is silent; flip any of these before execution)

- Skipping a **work** block does not count it as completed, writes no session row, and does not trigger the end-of-block check-in. Skipping goes to a short break without advancing the long-break counter. Skipping a break goes straight to work.
- Time the machine is suspended (laptop sleep, process stall longer than 30 s) does not consume the timer: the deadline is pushed back by the gap.
- Only completed **work** blocks are written to `sessions`. Breaks are not recorded.
- One timer at a time. `start` while a timer is running is ignored.
- `blocksPerLongBreak` is bounded 1-12 so the long-break modulo never divides by zero.
- Typed renderer exposure of the four new settings in `preload/index.ts` and `renderer/global.d.ts` is left to the Settings UI plan. Main-side `settings:update` already accepts them.

## Review Focus

Failure modes the spec implies but a happy path would miss, most likely first:

- Laptop sleep: after hours suspended, the timer resumes where it left off. It never fires a work-block-completed or writes a session row for work the user did not do. Pinned in Task 4 test "suspend".
- A very late tick (machine alone, no service): one transition and a fresh countdown, never a burst of events. Pinned in Task 1.
- Pause then resume: nothing fires while paused, and the deadline shifts by the paused duration. Pinned in Tasks 1 and 4.
- Long-break cadence: every Nth completed work block gets the long break, and skipping does not corrupt the count. Pinned in Task 1.
- Out-of-range or non-numeric settings (`'abc'`, `0`, negative, huge): clamped so a phase is never zero-length and `blocksPerLongBreak` is never 0. Pinned in Task 3.
- Double start, stop or pause while idle, and a leaked interval after stop: all no-ops, and no interval runs while idle. Pinned in Tasks 1, 4, 5.

Suggested PR stack: PR 1 = Task 1, PR 2 = Task 2, PR 3 = Tasks 3-4 (settings + service), PR 4 = Task 5 (IPC + preload). Each is green on its own.

---

### Task 1: Timer types and pure state machine

**Files:**
- Create: `app/src/shared/timer.ts`
- Create: `app/src/main/timer/machine.ts`
- Test: `app/tests/timer/machine.test.ts`

**Interfaces:**
- Produces (`@shared/timer.js`): `TimerPhase`, `RunningPhase`, `TimerConfig`, `TimerState`, `TimerEvent`, `TimerTransition`, `TimerSnapshot` exactly as in Step 3.
- Produces (`@main/timer/machine.js`): `IDLE_TIMER: TimerState`, `startTimer(config, nowMs): TimerTransition`, `tick(state, config, nowMs): TimerTransition`, `pauseTimer(state, nowMs): TimerTransition`, `resumeTimer(state, nowMs): TimerTransition`, `skipPhase(state, config, nowMs): TimerTransition`, `stopTimer(state): TimerTransition`, `delayPhase(state, byMs): TimerTransition`, `remainingSeconds(state, nowMs): number`. All pure; `nowMs` is epoch ms. A no-op returns the same `state` reference and `events: []`.
- Event order contract: when a work block completes, `work-block-completed` comes before the `phase-started` of the following break.

- [ ] **Step 1: Write the failing tests**

Create `app/tests/timer/machine.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  IDLE_TIMER,
  delayPhase,
  pauseTimer,
  remainingSeconds,
  resumeTimer,
  skipPhase,
  startTimer,
  stopTimer,
  tick,
} from '@main/timer/machine.js';
import type { TimerConfig, TimerState } from '@shared/timer.js';

const MIN = 60_000;
const T0 = 1_000_000;
const config: TimerConfig = {
  workMinutes: 25,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
  blocksPerLongBreak: 4,
};

function endOfPhase(state: TimerState, cfg: TimerConfig = config) {
  return tick(state, cfg, state.phaseEndsAt);
}

describe('startTimer', () => {
  it('enters work with a countdown and a phase-started event', () => {
    const { state, events } = startTimer(config, T0);
    expect(state).toEqual({
      phase: 'work',
      phaseEndsAt: T0 + 25 * MIN,
      blocksCompleted: 0,
      pausedAt: null,
    });
    expect(events).toEqual([
      { type: 'phase-started', phase: 'work', plannedSeconds: 1500, blocksCompleted: 0 },
    ]);
  });
});

describe('tick', () => {
  it('is a no-op before the phase ends', () => {
    const { state } = startTimer(config, T0);
    const result = tick(state, config, T0 + 24 * MIN);
    expect(result.state).toBe(state);
    expect(result.events).toEqual([]);
  });

  it('completes a work block into a short break, work-block-completed first', () => {
    const { state } = startTimer(config, T0);
    const result = endOfPhase(state);
    expect(result.state).toEqual({
      phase: 'shortBreak',
      phaseEndsAt: T0 + 30 * MIN,
      blocksCompleted: 1,
      pausedAt: null,
    });
    expect(result.events).toEqual([
      { type: 'work-block-completed', blocksCompleted: 1 },
      { type: 'phase-started', phase: 'shortBreak', plannedSeconds: 300, blocksCompleted: 1 },
    ]);
  });

  it('returns from a break to work without counting a block', () => {
    const inBreak = endOfPhase(startTimer(config, T0).state).state;
    const result = endOfPhase(inBreak);
    expect(result.state.phase).toBe('work');
    expect(result.state.blocksCompleted).toBe(1);
    expect(result.events).toEqual([
      { type: 'phase-started', phase: 'work', plannedSeconds: 1500, blocksCompleted: 1 },
    ]);
  });

  it('gives the long break after every 4th completed work block', () => {
    let state = startTimer(config, T0).state;
    const breaks: string[] = [];
    for (let block = 1; block <= 5; block += 1) {
      state = endOfPhase(state).state;
      breaks.push(state.phase);
      state = endOfPhase(state).state;
    }
    expect(breaks).toEqual(['shortBreak', 'shortBreak', 'shortBreak', 'longBreak', 'shortBreak']);
  });

  it('uses the configured long break length', () => {
    let state = startTimer(config, T0).state;
    for (let block = 1; block < 4; block += 1) {
      state = endOfPhase(endOfPhase(state).state).state;
    }
    const result = endOfPhase(state);
    expect(result.events).toEqual([
      { type: 'work-block-completed', blocksCompleted: 4 },
      { type: 'phase-started', phase: 'longBreak', plannedSeconds: 900, blocksCompleted: 4 },
    ]);
  });

  it('gives a long break every block when blocksPerLongBreak is 1', () => {
    const cfg = { ...config, blocksPerLongBreak: 1 };
    const result = endOfPhase(startTimer(cfg, T0).state, cfg);
    expect(result.state.phase).toBe('longBreak');
  });

  it('a very late tick makes one transition with a fresh countdown, not a burst', () => {
    const { state } = startTimer(config, T0);
    const late = T0 + 10 * 60 * MIN;
    const result = tick(state, config, late);
    expect(result.state.phase).toBe('shortBreak');
    expect(result.state.blocksCompleted).toBe(1);
    expect(result.state.phaseEndsAt).toBe(late + 5 * MIN);
    expect(result.events).toHaveLength(2);
  });

  it('does nothing when idle', () => {
    const result = tick(IDLE_TIMER, config, T0);
    expect(result.state).toBe(IDLE_TIMER);
    expect(result.events).toEqual([]);
  });
});

describe('pause and resume', () => {
  it('emits nothing while paused, even past the phase end', () => {
    const { state } = startTimer(config, T0);
    const paused = pauseTimer(state, T0 + 5 * MIN).state;
    const result = tick(paused, config, T0 + 5 * 60 * MIN);
    expect(result.state).toBe(paused);
    expect(result.events).toEqual([]);
  });

  it('shifts the deadline by the paused duration on resume', () => {
    const { state } = startTimer(config, T0);
    const paused = pauseTimer(state, T0 + 5 * MIN).state;
    const resumed = resumeTimer(paused, T0 + 65 * MIN).state;
    expect(resumed.pausedAt).toBeNull();
    expect(resumed.phaseEndsAt).toBe(T0 + 85 * MIN);
    expect(tick(resumed, config, T0 + 84 * MIN).events).toEqual([]);
    expect(tick(resumed, config, T0 + 85 * MIN).events).toHaveLength(2);
  });

  it('keeps the first pause time when paused twice', () => {
    const { state } = startTimer(config, T0);
    const once = pauseTimer(state, T0 + 5 * MIN).state;
    expect(pauseTimer(once, T0 + 8 * MIN).state).toBe(once);
  });

  it('ignores resume when not paused and pause when idle', () => {
    const { state } = startTimer(config, T0);
    expect(resumeTimer(state, T0 + MIN).state).toBe(state);
    expect(pauseTimer(IDLE_TIMER, T0).state).toBe(IDLE_TIMER);
    expect(resumeTimer(IDLE_TIMER, T0).state).toBe(IDLE_TIMER);
  });

  it('can pause during a break', () => {
    const inBreak = endOfPhase(startTimer(config, T0).state).state;
    const paused = pauseTimer(inBreak, T0 + 26 * MIN).state;
    const resumed = resumeTimer(paused, T0 + 36 * MIN).state;
    expect(resumed.phaseEndsAt).toBe(T0 + 40 * MIN);
  });
});

describe('skipPhase', () => {
  it('skips work to a short break without counting the block', () => {
    const { state } = startTimer(config, T0);
    const result = skipPhase(state, config, T0 + 2 * MIN);
    expect(result.state).toEqual({
      phase: 'shortBreak',
      phaseEndsAt: T0 + 7 * MIN,
      blocksCompleted: 0,
      pausedAt: null,
    });
    expect(result.events).toEqual([
      { type: 'phase-started', phase: 'shortBreak', plannedSeconds: 300, blocksCompleted: 0 },
    ]);
  });

  it('skips a break to work', () => {
    const inBreak = endOfPhase(startTimer(config, T0).state).state;
    const result = skipPhase(inBreak, config, T0 + 26 * MIN);
    expect(result.state.phase).toBe('work');
    expect(result.state.phaseEndsAt).toBe(T0 + 51 * MIN);
    expect(result.state.blocksCompleted).toBe(1);
  });

  it('clears a pause so the new phase runs', () => {
    const { state } = startTimer(config, T0);
    const paused = pauseTimer(state, T0 + MIN).state;
    const result = skipPhase(paused, config, T0 + 10 * MIN);
    expect(result.state.pausedAt).toBeNull();
  });

  it('does not corrupt the long-break count', () => {
    let state = startTimer(config, T0).state;
    state = skipPhase(state, config, T0 + MIN).state;
    state = skipPhase(state, config, T0 + 2 * MIN).state;
    const result = endOfPhase(state);
    expect(result.state.blocksCompleted).toBe(1);
    expect(result.state.phase).toBe('shortBreak');
  });

  it('is a no-op when idle', () => {
    expect(skipPhase(IDLE_TIMER, config, T0).state).toBe(IDLE_TIMER);
  });
});

describe('stopTimer', () => {
  it('returns to idle with a stopped event carrying the block count', () => {
    const inBreak = endOfPhase(startTimer(config, T0).state).state;
    const result = stopTimer(inBreak);
    expect(result.state).toBe(IDLE_TIMER);
    expect(result.events).toEqual([{ type: 'stopped', blocksCompleted: 1 }]);
  });

  it('can stop while paused, is a no-op when idle, and later ticks are silent', () => {
    const { state } = startTimer(config, T0);
    const paused = pauseTimer(state, T0 + MIN).state;
    const stopped = stopTimer(paused);
    expect(stopped.state.phase).toBe('idle');
    expect(stopTimer(stopped.state).events).toEqual([]);
    expect(tick(stopped.state, config, T0 + 99 * MIN).events).toEqual([]);
  });
});

describe('delayPhase', () => {
  it('pushes the deadline back while running', () => {
    const { state } = startTimer(config, T0);
    expect(delayPhase(state, 3 * MIN).state.phaseEndsAt).toBe(T0 + 28 * MIN);
  });

  it('is a no-op when paused or idle', () => {
    const { state } = startTimer(config, T0);
    const paused = pauseTimer(state, T0 + MIN).state;
    expect(delayPhase(paused, MIN).state).toBe(paused);
    expect(delayPhase(IDLE_TIMER, MIN).state).toBe(IDLE_TIMER);
  });
});

describe('remainingSeconds', () => {
  it('counts down while running and rounds up', () => {
    const { state } = startTimer(config, T0);
    expect(remainingSeconds(state, T0)).toBe(1500);
    expect(remainingSeconds(state, T0 + 1500)).toBe(1499);
    expect(remainingSeconds(state, T0 + 24 * MIN)).toBe(60);
  });

  it('freezes at the pause time, is 0 when idle or overdue', () => {
    const { state } = startTimer(config, T0);
    const paused = pauseTimer(state, T0 + 5 * MIN).state;
    expect(remainingSeconds(paused, T0 + 60 * MIN)).toBe(1200);
    expect(remainingSeconds(IDLE_TIMER, T0)).toBe(0);
    expect(remainingSeconds(state, T0 + 99 * MIN)).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter ./app exec vitest run tests/timer/machine.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement**

Create `app/src/shared/timer.ts`:

```ts
export type TimerPhase = 'idle' | 'work' | 'shortBreak' | 'longBreak';
export type RunningPhase = Exclude<TimerPhase, 'idle'>;

export interface TimerConfig {
  workMinutes: number;
  shortBreakMinutes: number;
  longBreakMinutes: number;
  blocksPerLongBreak: number;
}

export interface TimerState {
  phase: TimerPhase;
  phaseEndsAt: number;
  blocksCompleted: number;
  pausedAt: number | null;
}

export type TimerEvent =
  | { type: 'phase-started'; phase: RunningPhase; plannedSeconds: number; blocksCompleted: number }
  | { type: 'work-block-completed'; blocksCompleted: number }
  | { type: 'stopped'; blocksCompleted: number };

export interface TimerTransition {
  state: TimerState;
  events: TimerEvent[];
}

export interface TimerSnapshot {
  phase: TimerPhase;
  paused: boolean;
  remainingSeconds: number;
  endsAt: number | null;
  blocksCompleted: number;
  taskId: string | null;
}
```

Create `app/src/main/timer/machine.ts`:

```ts
import type {
  RunningPhase,
  TimerConfig,
  TimerEvent,
  TimerState,
  TimerTransition,
} from '@shared/timer.js';

export const IDLE_TIMER: TimerState = {
  phase: 'idle',
  phaseEndsAt: 0,
  blocksCompleted: 0,
  pausedAt: null,
};

function isRunning(state: TimerState): boolean {
  return state.phase !== 'idle';
}

function plannedSeconds(phase: RunningPhase, config: TimerConfig): number {
  if (phase === 'work') return config.workMinutes * 60;
  if (phase === 'shortBreak') return config.shortBreakMinutes * 60;
  return config.longBreakMinutes * 60;
}

function beginPhase(
  phase: RunningPhase,
  blocksCompleted: number,
  config: TimerConfig,
  nowMs: number,
): { state: TimerState; event: TimerEvent } {
  const seconds = plannedSeconds(phase, config);
  return {
    state: { phase, phaseEndsAt: nowMs + seconds * 1000, blocksCompleted, pausedAt: null },
    event: { type: 'phase-started', phase, plannedSeconds: seconds, blocksCompleted },
  };
}

export function startTimer(config: TimerConfig, nowMs: number): TimerTransition {
  const { state, event } = beginPhase('work', 0, config, nowMs);
  return { state, events: [event] };
}

// One tick makes at most one transition so a tick delayed by sleep never replays missed phases.
function advance(state: TimerState, config: TimerConfig, nowMs: number): TimerTransition {
  if (state.phase === 'work') {
    const blocksCompleted = state.blocksCompleted + 1;
    const next: RunningPhase =
      blocksCompleted % config.blocksPerLongBreak === 0 ? 'longBreak' : 'shortBreak';
    const { state: nextState, event } = beginPhase(next, blocksCompleted, config, nowMs);
    return {
      state: nextState,
      events: [{ type: 'work-block-completed', blocksCompleted }, event],
    };
  }
  const { state: nextState, event } = beginPhase('work', state.blocksCompleted, config, nowMs);
  return { state: nextState, events: [event] };
}

export function tick(state: TimerState, config: TimerConfig, nowMs: number): TimerTransition {
  if (!isRunning(state) || state.pausedAt !== null || nowMs < state.phaseEndsAt) {
    return { state, events: [] };
  }
  return advance(state, config, nowMs);
}

export function pauseTimer(state: TimerState, nowMs: number): TimerTransition {
  if (!isRunning(state) || state.pausedAt !== null) {
    return { state, events: [] };
  }
  return { state: { ...state, pausedAt: nowMs }, events: [] };
}

export function resumeTimer(state: TimerState, nowMs: number): TimerTransition {
  if (state.pausedAt === null) {
    return { state, events: [] };
  }
  const pausedFor = nowMs - state.pausedAt;
  return {
    state: { ...state, pausedAt: null, phaseEndsAt: state.phaseEndsAt + pausedFor },
    events: [],
  };
}

export function skipPhase(state: TimerState, config: TimerConfig, nowMs: number): TimerTransition {
  if (!isRunning(state)) {
    return { state, events: [] };
  }
  const next: RunningPhase = state.phase === 'work' ? 'shortBreak' : 'work';
  const { state: nextState, event } = beginPhase(next, state.blocksCompleted, config, nowMs);
  return { state: nextState, events: [event] };
}

export function stopTimer(state: TimerState): TimerTransition {
  if (!isRunning(state)) {
    return { state, events: [] };
  }
  return {
    state: IDLE_TIMER,
    events: [{ type: 'stopped', blocksCompleted: state.blocksCompleted }],
  };
}

export function delayPhase(state: TimerState, byMs: number): TimerTransition {
  if (!isRunning(state) || state.pausedAt !== null) {
    return { state, events: [] };
  }
  return { state: { ...state, phaseEndsAt: state.phaseEndsAt + byMs }, events: [] };
}

export function remainingSeconds(state: TimerState, nowMs: number): number {
  if (!isRunning(state)) return 0;
  const reference = state.pausedAt ?? nowMs;
  return Math.max(0, Math.ceil((state.phaseEndsAt - reference) / 1000));
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter ./app exec vitest run tests/timer/machine.test.ts`
Expected: PASS (all tests).

- [ ] **Step 5: Typecheck, lint, commit**

Run: `pnpm typecheck && pnpm lint` (expected clean; echo the exit codes).

```bash
git add app/src/shared/timer.ts app/src/main/timer/machine.ts app/tests/timer/machine.test.ts
git commit -m "feat(timer): pure pomodoro state machine with long breaks, skip and stop

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Sessions get `phase` and `planned_seconds` (migration v8, type, repo)

**Files:**
- Modify: `app/src/main/store/db.ts` (append v8 after the v7 entry)
- Modify: `app/src/shared/types.ts` (the `Session` interface, currently `id, task_id, started_at, ended_at`)
- Modify: `app/src/main/store/repos/sessions.ts` (whole file)
- Modify: `app/tests/store/store.test.ts:32` (`toBe(7)` to `toBe(8)`)
- Modify: `app/tests/store/migrations-v6.test.ts:37` (`toBe(7)` to `toBe(8)`)
- Create: `app/tests/store/sessions-timer-columns.test.ts`

**Interfaces:**
- Produces: `Session` gains `phase: 'work' | 'shortBreak' | 'longBreak'` and `planned_seconds: number | null`. `SessionsRepo.create(input: SessionInput): Session` where `SessionInput = Pick<Session,'task_id'|'started_at'|'ended_at'> & Partial<Pick<Session,'phase'|'planned_seconds'>>`, defaults `'work'` and `null`. `update` patch handles both new fields. Existing callers and tests passing only `task_id/started_at/ended_at` keep working.

- [ ] **Step 1: Write the failing test**

Create `app/tests/store/sessions-timer-columns.test.ts`:

```ts
import { describe, expect, it, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { runMigrations } from '@main/store/db.js';
import { SessionsRepo } from '@main/store/repos/sessions.js';

describe('SessionsRepo pomodoro columns', () => {
  let db: Database.Database;
  let repo: SessionsRepo;

  beforeEach(() => {
    db = new Database(':memory:');
    runMigrations(db);
    repo = new SessionsRepo(db);
  });

  it('defaults to a work phase with no planned length', () => {
    const created = repo.create({
      task_id: null,
      started_at: '2026-10-12T10:00:00.000Z',
      ended_at: null,
    });
    expect(created.phase).toBe('work');
    expect(created.planned_seconds).toBeNull();
    expect(repo.get(created.id)).toEqual(created);
  });

  it('persists explicit phase and planned_seconds', () => {
    const created = repo.create({
      task_id: null,
      started_at: '2026-10-12T10:00:00.000Z',
      ended_at: '2026-10-12T10:25:00.000Z',
      phase: 'longBreak',
      planned_seconds: 900,
    });
    expect(repo.get(created.id)).toMatchObject({ phase: 'longBreak', planned_seconds: 900 });
  });

  it('updates planned_seconds, including back to null, without touching other fields', () => {
    const created = repo.create({
      task_id: null,
      started_at: '2026-10-12T10:00:00.000Z',
      ended_at: null,
      planned_seconds: 1500,
    });
    const updated = repo.update(created.id, { planned_seconds: null });
    expect(updated).toEqual({ ...created, planned_seconds: null });
    expect(repo.get(created.id)).toEqual(updated);
  });

  it('inserts a bare row with the column defaults', () => {
    db.prepare("INSERT INTO sessions (id) VALUES ('bare')").run();
    expect(repo.get('bare')).toMatchObject({ phase: 'work', planned_seconds: null });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter ./app exec vitest run tests/store/sessions-timer-columns.test.ts`
Expected: FAIL (`phase` undefined / no such column).

- [ ] **Step 3: Write the migration, type, and repo**

In `app/src/main/store/db.ts`, add after the version 7 entry inside `MIGRATIONS`:

```ts
  {
    version: 8,
    sql: `
      ALTER TABLE sessions ADD COLUMN phase TEXT NOT NULL DEFAULT 'work';
      ALTER TABLE sessions ADD COLUMN planned_seconds INTEGER;
    `,
  },
```

In `app/src/shared/types.ts` replace the `Session` interface:

```ts
export interface Session {
  id: string;
  task_id: string | null;
  started_at: string | null; // ISO8601 string
  ended_at: string | null; // ISO8601 string
  phase: 'work' | 'shortBreak' | 'longBreak';
  planned_seconds: number | null;
}
```

Replace `app/src/main/store/repos/sessions.ts` with:

```ts
import { randomUUID } from 'node:crypto';
import Database from 'better-sqlite3';
import { Session } from '@shared/types.js';

export type SessionInput = Pick<Session, 'task_id' | 'started_at' | 'ended_at'> &
  Partial<Pick<Session, 'phase' | 'planned_seconds'>>;

const COLUMNS = 'id, task_id, started_at, ended_at, phase, planned_seconds';

export class SessionsRepo {
  private db: Database.Database;
  private createStmt: Database.Statement;
  private getStmt: Database.Statement;
  private listStmt: Database.Statement;
  private updateStmt: Database.Statement;
  private deleteStmt: Database.Statement;

  constructor(db: Database.Database) {
    this.db = db;
    this.createStmt = this.db.prepare(`
      INSERT INTO sessions (${COLUMNS})
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    this.getStmt = this.db.prepare(`SELECT ${COLUMNS} FROM sessions WHERE id = ?`);
    this.listStmt = this.db.prepare(`SELECT ${COLUMNS} FROM sessions`);
    this.updateStmt = this.db.prepare(`
      UPDATE sessions
      SET task_id = ?, started_at = ?, ended_at = ?, phase = ?, planned_seconds = ?
      WHERE id = ?
    `);
    this.deleteStmt = this.db.prepare('DELETE FROM sessions WHERE id = ?');
  }

  create(input: SessionInput): Session {
    const session: Session = {
      id: randomUUID(),
      task_id: input.task_id,
      started_at: input.started_at,
      ended_at: input.ended_at,
      phase: input.phase ?? 'work',
      planned_seconds: input.planned_seconds ?? null,
    };

    this.createStmt.run(
      session.id,
      session.task_id,
      session.started_at,
      session.ended_at,
      session.phase,
      session.planned_seconds,
    );

    return session;
  }

  get(id: string): Session | null {
    const row = this.getStmt.get(id) as Session | undefined;
    return row ?? null;
  }

  list(): Session[] {
    return this.listStmt.all() as Session[];
  }

  update(id: string, patch: Partial<Omit<Session, 'id'>>): Session {
    const existing = this.get(id);
    if (!existing) {
      throw new Error(`Session with id ${id} not found`);
    }

    const updated: Session = {
      id,
      task_id: patch.task_id !== undefined ? patch.task_id : existing.task_id,
      started_at: patch.started_at !== undefined ? patch.started_at : existing.started_at,
      ended_at: patch.ended_at !== undefined ? patch.ended_at : existing.ended_at,
      phase: patch.phase ?? existing.phase,
      planned_seconds:
        patch.planned_seconds !== undefined ? patch.planned_seconds : existing.planned_seconds,
    };

    this.updateStmt.run(
      updated.task_id,
      updated.started_at,
      updated.ended_at,
      updated.phase,
      updated.planned_seconds,
      id,
    );

    return updated;
  }

  delete(id: string): void {
    this.deleteStmt.run(id);
  }
}
```

In `app/tests/store/store.test.ts:32` change `toBe(7)` to `toBe(8)`. In `app/tests/store/migrations-v6.test.ts:37` change `toBe(7)` to `toBe(8)`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter ./app exec vitest run tests/store`
Expected: PASS for all store tests, including the existing `sessions-repo.test.ts` unchanged.

- [ ] **Step 5: Typecheck and commit**

Run: `pnpm typecheck` (expected clean; fix any other `Session` literal by adding the two fields).

```bash
git add app/src/main/store/db.ts app/src/shared/types.ts app/src/main/store/repos/sessions.ts app/tests/store
git commit -m "feat(store): add phase and planned_seconds to sessions (migration v8)

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Timer settings with clamping

**Files:**
- Modify: `app/src/main/store/repos/settings.ts` (`SettingsData` interface, `getAll`, `update`)
- Create: `app/tests/store/settings-timer.test.ts`

**Interfaces:**
- Produces: `SettingsData` gains `workMinutes`, `shortBreakMinutes`, `longBreakMinutes`, `blocksPerLongBreak` (all `number`). Defaults 25 / 5 / 15 / 4. Bounds: work 1-180, short break 1-60, long break 1-120, blocks 1-12. `getAll()` and `update()` both clamp, so out-of-range or non-numeric stored values read back as a safe integer. These four names and units match `TimerConfig` in `@shared/timer.js`, so `settingsRepo.getAll()` is assignable to `TimerConfig`.

- [ ] **Step 1: Write the failing test**

Create `app/tests/store/settings-timer.test.ts`:

```ts
import { describe, expect, it, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { runMigrations } from '@main/store/db.js';
import { SettingsRepo } from '@main/store/repos/settings.js';

function timerValues(repo: SettingsRepo) {
  const s = repo.getAll();
  return [s.workMinutes, s.shortBreakMinutes, s.longBreakMinutes, s.blocksPerLongBreak];
}

describe('SettingsRepo timer settings', () => {
  let repo: SettingsRepo;

  beforeEach(() => {
    const db = new Database(':memory:');
    runMigrations(db);
    repo = new SettingsRepo(db);
  });

  it('defaults to 25/5 with a 15 minute long break after 4 blocks', () => {
    expect(timerValues(repo)).toEqual([25, 5, 15, 4]);
  });

  it('round-trips valid values', () => {
    repo.update({
      workMinutes: 50,
      shortBreakMinutes: 10,
      longBreakMinutes: 30,
      blocksPerLongBreak: 3,
    });
    expect(timerValues(repo)).toEqual([50, 10, 30, 3]);
  });

  it('clamps out-of-range values on write', () => {
    repo.update({
      workMinutes: 0,
      shortBreakMinutes: 999,
      longBreakMinutes: -5,
      blocksPerLongBreak: 500,
    });
    expect(timerValues(repo)).toEqual([1, 60, 1, 12]);
  });

  it('never lets blocksPerLongBreak reach 0', () => {
    repo.update({ blocksPerLongBreak: 0 });
    expect(repo.getAll().blocksPerLongBreak).toBe(1);
  });

  it('rounds fractional values', () => {
    repo.update({ workMinutes: 24.6 });
    expect(repo.getAll().workMinutes).toBe(25);
  });

  it('falls back to defaults when the stored value is not a number', () => {
    repo.set('workMinutes', 'abc');
    repo.set('shortBreakMinutes', '');
    repo.set('longBreakMinutes', 'NaN');
    repo.set('blocksPerLongBreak', 'many');
    expect(timerValues(repo)).toEqual([25, 5, 15, 4]);
  });

  it('clamps raw stored values on read', () => {
    repo.set('workMinutes', '100000');
    repo.set('blocksPerLongBreak', '-3');
    const s = repo.getAll();
    expect(s.workMinutes).toBe(180);
    expect(s.blocksPerLongBreak).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter ./app exec vitest run tests/store/settings-timer.test.ts`
Expected: FAIL (properties undefined).

- [ ] **Step 3: Implement**

In `app/src/main/store/repos/settings.ts`:

Add to `SettingsData` (after `githubWatchedRepos: string[];`):

```ts
  workMinutes: number;
  shortBreakMinutes: number;
  longBreakMinutes: number;
  blocksPerLongBreak: number;
```

Add above `export class SettingsRepo`:

```ts
const TIMER_BOUNDS = {
  workMinutes: { fallback: 25, min: 1, max: 180 },
  shortBreakMinutes: { fallback: 5, min: 1, max: 60 },
  longBreakMinutes: { fallback: 15, min: 1, max: 120 },
  blocksPerLongBreak: { fallback: 4, min: 1, max: 12 },
} as const;

type TimerKey = keyof typeof TIMER_BOUNDS;

function clampTimer(key: TimerKey, raw: number | string | undefined): number {
  const { fallback, min, max } = TIMER_BOUNDS[key];
  if (raw === undefined || raw === '') return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}
```

In `getAll`, before `return {`:

```ts
    const workMinutes = clampTimer('workMinutes', map.get('workMinutes'));
    const shortBreakMinutes = clampTimer('shortBreakMinutes', map.get('shortBreakMinutes'));
    const longBreakMinutes = clampTimer('longBreakMinutes', map.get('longBreakMinutes'));
    const blocksPerLongBreak = clampTimer('blocksPerLongBreak', map.get('blocksPerLongBreak'));
```

and add `workMinutes, shortBreakMinutes, longBreakMinutes, blocksPerLongBreak,` to the returned object after `githubWatchedRepos,`.

In `update`, after the `githubWatchedRepos` block:

```ts
    for (const key of Object.keys(TIMER_BOUNDS) as TimerKey[]) {
      const value = patch[key];
      if (value !== undefined) {
        this.set(key, String(clampTimer(key, value)));
      }
    }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter ./app exec vitest run tests/store`
Expected: PASS (new file and the existing `settings-repo.test.ts`).

- [ ] **Step 5: Typecheck and commit**

Run: `pnpm typecheck` (expected clean).

```bash
git add app/src/main/store/repos/settings.ts app/tests/store/settings-timer.test.ts
git commit -m "feat(store): add clamped pomodoro timer settings

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 4: TimerService (ticking driver, session recording, bus events)

**Files:**
- Modify: `app/src/shared/events.ts` (add import and two `EventPayloads` entries)
- Create: `app/src/main/timer/service.ts`
- Test: `app/tests/timer/service.test.ts`

**Interfaces:**
- Consumes: everything exported by `@main/timer/machine.js` (Task 1), `SessionsRepo` / `SessionInput` (Task 2), `TypedEventBus` from `@main/events/bus.js`.
- Produces: `TimerServiceDeps { getConfig: () => TimerConfig; sessions: Pick<SessionsRepo, 'create'>; bus: TypedEventBus; now: () => number }`; `class TimerService` with `start(taskId: string | null): TimerSnapshot`, `pause(): TimerSnapshot`, `resume(): TimerSnapshot`, `skip(): TimerSnapshot`, `stop(): TimerSnapshot`, `tick(): void`, `snapshot(): TimerSnapshot`; `SUSPEND_GAP_MS = 30_000`. A 1 s interval runs only while the timer is not idle.
- Bus events: `'timer.changed': TimerSnapshot` after every state change (not on plain ticks); `'timer.work-block-completed': { blocksCompleted: number; taskId: string | null; sessionId: string }` emitted before the `timer.changed` that reports the following break.

- [ ] **Step 1: Write the failing tests**

Create `app/tests/timer/service.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Database from 'better-sqlite3';
import { runMigrations } from '@main/store/db.js';
import { SessionsRepo } from '@main/store/repos/sessions.js';
import { GoalsRepo } from '@main/store/repos/goals.js';
import { TasksRepo } from '@main/store/repos/tasks.js';
import { TypedEventBus } from '@main/events/bus.js';
import { TimerService } from '@main/timer/service.js';
import type { TimerConfig, TimerSnapshot } from '@shared/timer.js';

const SEC = 1000;
const MIN = 60_000;
const T0 = 1_000_000;

describe('TimerService', () => {
  let db: Database.Database;
  let sessions: SessionsRepo;
  let bus: TypedEventBus;
  let service: TimerService;
  let nowMs: number;
  let config: TimerConfig;
  let changed: TimerSnapshot[];
  let completed: { blocksCompleted: number; taskId: string | null; sessionId: string }[];

  const advance = (ms: number) => {
    for (let elapsed = 0; elapsed < ms; elapsed += SEC) {
      nowMs += SEC;
      service.tick();
    }
  };

  beforeEach(() => {
    db = new Database(':memory:');
    runMigrations(db);
    sessions = new SessionsRepo(db);
    bus = new TypedEventBus();
    nowMs = T0;
    config = { workMinutes: 25, shortBreakMinutes: 5, longBreakMinutes: 15, blocksPerLongBreak: 4 };
    changed = [];
    completed = [];
    bus.on('timer.changed', (snapshot) => changed.push(snapshot));
    bus.on('timer.work-block-completed', (payload) => completed.push(payload));
    service = new TimerService({ getConfig: () => config, sessions, bus, now: () => nowMs });
  });

  afterEach(() => {
    service.stop();
    vi.useRealTimers();
  });

  it('start emits a work snapshot with the countdown and task id', () => {
    const snapshot = service.start(null);
    expect(snapshot).toEqual({
      phase: 'work',
      paused: false,
      remainingSeconds: 1500,
      endsAt: T0 + 25 * MIN,
      blocksCompleted: 0,
      taskId: null,
    });
    expect(changed).toEqual([snapshot]);
  });

  it('ignores start while a timer is running', () => {
    service.start(null);
    advance(10 * SEC);
    const before = service.snapshot();
    expect(service.start('other')).toEqual(before);
    expect(changed).toHaveLength(1);
  });

  it('records a completed work block and emits the check-in trigger', () => {
    const goal = new GoalsRepo(db).create({ title: 'Goal', status: 'active' });
    const task = new TasksRepo(db).create({
      goal_id: goal.id,
      title: 'Task',
      estimate_minutes: 30,
      status: 'todo',
    });
    service.start(task.id);
    advance(25 * MIN);

    const rows = sessions.list();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      task_id: task.id,
      phase: 'work',
      planned_seconds: 1500,
      started_at: new Date(T0).toISOString(),
      ended_at: new Date(T0 + 25 * MIN).toISOString(),
    });
    expect(completed).toEqual([
      { blocksCompleted: 1, taskId: task.id, sessionId: rows[0]?.id },
    ]);
    expect(service.snapshot()).toMatchObject({ phase: 'shortBreak', blocksCompleted: 1 });
  });

  it('records one row per work block across a full cycle but none for breaks', () => {
    service.start(null);
    advance(25 * MIN);
    advance(5 * MIN);
    advance(25 * MIN);
    expect(sessions.list()).toHaveLength(2);
    expect(sessions.list().every((s) => s.phase === 'work')).toBe(true);
  });

  it('skip does not record a session and moves work to a short break', () => {
    service.start(null);
    advance(2 * MIN);
    const snapshot = service.skip();
    expect(snapshot).toMatchObject({ phase: 'shortBreak', blocksCompleted: 0 });
    expect(sessions.list()).toHaveLength(0);
    expect(completed).toEqual([]);
  });

  it('stop returns to idle without recording and clears the interval', () => {
    vi.useFakeTimers();
    service.start(null);
    expect(vi.getTimerCount()).toBe(1);
    const snapshot = service.stop();
    expect(snapshot).toMatchObject({ phase: 'idle', paused: false, remainingSeconds: 0, endsAt: null });
    expect(vi.getTimerCount()).toBe(0);
    expect(sessions.list()).toHaveLength(0);
  });

  it('runs no interval while idle', () => {
    vi.useFakeTimers();
    service.pause();
    service.skip();
    service.stop();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('suspend: a long gap between ticks pushes the deadline back and fires nothing', () => {
    service.start(null);
    advance(10 * MIN);
    const endsBefore = service.snapshot().endsAt;
    nowMs += 8 * 60 * MIN;
    service.tick();
    const snapshot = service.snapshot();
    expect(snapshot.phase).toBe('work');
    expect(snapshot.endsAt).toBe((endsBefore ?? 0) + 8 * 60 * MIN);
    expect(sessions.list()).toHaveLength(0);
    expect(completed).toEqual([]);
  });

  it('pause freezes the countdown and resume continues from it', () => {
    service.start(null);
    advance(5 * MIN);
    const paused = service.pause();
    expect(paused).toMatchObject({ paused: true, remainingSeconds: 1200, endsAt: null });
    advance(60 * MIN);
    expect(service.snapshot().remainingSeconds).toBe(1200);
    expect(completed).toEqual([]);
    const resumed = service.resume();
    expect(resumed).toMatchObject({ paused: false, remainingSeconds: 1200, endsAt: nowMs + 20 * MIN });
    advance(20 * MIN);
    expect(completed).toHaveLength(1);
  });

  it('reads the config again for each new phase', () => {
    service.start(null);
    config = { ...config, shortBreakMinutes: 9 };
    expect(service.skip().remainingSeconds).toBe(540);
  });

  it('does not emit timer.changed on a plain tick', () => {
    service.start(null);
    changed.length = 0;
    advance(10 * SEC);
    expect(changed).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter ./app exec vitest run tests/timer/service.test.ts`
Expected: FAIL (module not found, and `timer.changed` not a key of `EventPayloads`).

- [ ] **Step 3: Implement**

In `app/src/shared/events.ts` add near the other type imports at the top of the file:

```ts
import type { TimerSnapshot } from './timer.js';
```

and add these two entries to `EventPayloads` (after `'github.review': GitHubReviewPayload;`):

```ts
  'timer.changed': TimerSnapshot;
  'timer.work-block-completed': {
    blocksCompleted: number;
    taskId: string | null;
    sessionId: string;
  };
```

Create `app/src/main/timer/service.ts`:

```ts
import type { TypedEventBus } from '../events/bus.js';
import type { SessionsRepo } from '../store/repos/sessions.js';
import type { TimerConfig, TimerEvent, TimerSnapshot, TimerState, TimerTransition } from '@shared/timer.js';
import * as machine from './machine.js';

const TICK_MS = 1000;
export const SUSPEND_GAP_MS = 30_000;

export interface TimerServiceDeps {
  getConfig: () => TimerConfig;
  sessions: Pick<SessionsRepo, 'create'>;
  bus: TypedEventBus;
  now: () => number;
}

export class TimerService {
  private state: TimerState = machine.IDLE_TIMER;
  private taskId: string | null = null;
  private blockStartedAt = 0;
  private blockPlannedSeconds = 0;
  private lastTickAt = 0;
  private interval: ReturnType<typeof setInterval> | null = null;

  constructor(private deps: TimerServiceDeps) {}

  start(taskId: string | null): TimerSnapshot {
    if (this.state.phase !== 'idle') return this.snapshot();
    const now = this.deps.now();
    this.taskId = taskId;
    this.lastTickAt = now;
    this.apply(machine.startTimer(this.deps.getConfig(), now));
    this.interval = setInterval(() => this.tick(), TICK_MS);
    return this.snapshot();
  }

  pause(): TimerSnapshot {
    this.apply(machine.pauseTimer(this.state, this.deps.now()));
    return this.snapshot();
  }

  resume(): TimerSnapshot {
    this.apply(machine.resumeTimer(this.state, this.deps.now()));
    return this.snapshot();
  }

  skip(): TimerSnapshot {
    this.apply(machine.skipPhase(this.state, this.deps.getConfig(), this.deps.now()));
    return this.snapshot();
  }

  stop(): TimerSnapshot {
    this.apply(machine.stopTimer(this.state));
    return this.snapshot();
  }

  // A gap far above the tick interval means the process was suspended, and suspended time must not count.
  tick(): void {
    const now = this.deps.now();
    const gap = now - this.lastTickAt;
    this.lastTickAt = now;
    if (gap > SUSPEND_GAP_MS) {
      this.apply(machine.delayPhase(this.state, gap));
      return;
    }
    this.apply(machine.tick(this.state, this.deps.getConfig(), now));
  }

  snapshot(): TimerSnapshot {
    const now = this.deps.now();
    const idleOrPaused = this.state.phase === 'idle' || this.state.pausedAt !== null;
    return {
      phase: this.state.phase,
      paused: this.state.pausedAt !== null,
      remainingSeconds: machine.remainingSeconds(this.state, now),
      endsAt: idleOrPaused ? null : this.state.phaseEndsAt,
      blocksCompleted: this.state.blocksCompleted,
      taskId: this.taskId,
    };
  }

  private apply(transition: TimerTransition): void {
    const changed = transition.state !== this.state || transition.events.length > 0;
    this.state = transition.state;
    for (const event of transition.events) this.handle(event);
    if (changed) this.deps.bus.emit('timer.changed', this.snapshot());
  }

  private handle(event: TimerEvent): void {
    const now = this.deps.now();
    if (event.type === 'phase-started' && event.phase === 'work') {
      this.blockStartedAt = now;
      this.blockPlannedSeconds = event.plannedSeconds;
    } else if (event.type === 'work-block-completed') {
      const session = this.deps.sessions.create({
        task_id: this.taskId,
        started_at: new Date(this.blockStartedAt).toISOString(),
        ended_at: new Date(now).toISOString(),
        phase: 'work',
        planned_seconds: this.blockPlannedSeconds,
      });
      this.deps.bus.emit('timer.work-block-completed', {
        blocksCompleted: event.blocksCompleted,
        taskId: this.taskId,
        sessionId: session.id,
      });
    } else if (event.type === 'stopped') {
      this.clearInterval();
      this.taskId = null;
    }
  }

  private clearInterval(): void {
    if (this.interval !== null) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }
}
```

Note: `stop()` on an idle service is a machine no-op and never reaches `clearInterval`, so no interval can exist then. The test `afterEach` calls `service.stop()` to release any interval a failing test left behind.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter ./app exec vitest run tests/timer`
Expected: PASS (machine and service tests).

- [ ] **Step 5: Typecheck, lint, commit**

Run: `pnpm typecheck && pnpm lint` (expected clean; echo the exit codes). If Prettier reformats the long import line in `service.ts`, let lint-staged do it.

```bash
git add app/src/shared/events.ts app/src/main/timer/service.ts app/tests/timer/service.test.ts
git commit -m "feat(timer): add ticking TimerService with session recording and bus events

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 5: IPC, preload, and renderer typing

**Files:**
- Create: `app/src/main/ipc/timer.ts`
- Modify: `app/src/main/ipc/index.ts` (import and call `registerTimerHandlers()` in `setupIpcHandlers`, after `registerSummariesHandlers();`)
- Modify: `app/src/preload/index.ts` (import `TimerSnapshot`, add `TimerApi`, add `timer: TimerApi` to `PloverApi` after the `companion: CompanionApi;` line, add the `timer` implementation after the `companion: {...},` block)
- Modify: `app/src/renderer/global.d.ts` (add `timer` to `PloverAPI` after `platform: string;`)
- Test: `app/tests/main/timer-ipc.test.ts`

**Interfaces:**
- Consumes: `TimerService` and `TimerServiceDeps` (Task 4), `settingsRepo` / `sessionsRepo` from `../store/index.js`, `broadcast` from `./shared.js`, `eventBus`.
- Produces: IPC channels `timer:start` (arg `taskId: string | null`), `timer:pause`, `timer:resume`, `timer:skip`, `timer:stop`, `timer:getSnapshot`, each resolving to a `TimerSnapshot`. Push channels to renderers: `timer:changed` (payload `TimerSnapshot`) and `timer:workBlockCompleted` (payload `{ blocksCompleted, taskId, sessionId }`), subscribed with the existing `window.api.on(channel, cb)`. `window.api.timer` exposes `start/pause/resume/skip/stop/getSnapshot`. The buddy UI plan builds on exactly these names.

- [ ] **Step 1: Write the failing test**

Create `app/tests/main/timer-ipc.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const handlers = vi.hoisted(() => new Map<string, (...args: unknown[]) => unknown>());
const send = vi.hoisted(() => vi.fn());

vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn((channel: string, fn: (...args: unknown[]) => unknown) => {
      handlers.set(channel, fn);
    }),
  },
  BrowserWindow: {
    getAllWindows: vi.fn(() => [{ isDestroyed: () => false, webContents: { send } }]),
  },
}));

import { registerTimerHandlers } from '@main/ipc/timer.js';
import { eventBus } from '@main/events/bus.js';

const call = (channel: string, ...args: unknown[]) => {
  const handler = handlers.get(channel);
  if (!handler) throw new Error(`no handler registered for ${channel}`);
  return handler({}, ...args);
};

describe('timer IPC', () => {
  beforeEach(() => {
    handlers.clear();
    send.mockClear();
    eventBus.removeAllListeners();
    registerTimerHandlers();
  });

  afterEach(async () => {
    await call('timer:stop');
  });

  it('registers the six timer channels', () => {
    expect([...handlers.keys()].sort()).toEqual([
      'timer:getSnapshot',
      'timer:pause',
      'timer:resume',
      'timer:skip',
      'timer:start',
      'timer:stop',
    ]);
  });

  it('start returns a work snapshot and pushes timer:changed to windows', async () => {
    const snapshot = await call('timer:start', null);
    expect(snapshot).toMatchObject({ phase: 'work', paused: false, remainingSeconds: 1500 });
    expect(send).toHaveBeenCalledWith('timer:changed', expect.objectContaining({ phase: 'work' }));
  });

  it('getSnapshot, pause, resume and skip reflect the running timer', async () => {
    await call('timer:start', null);
    expect(await call('timer:getSnapshot')).toMatchObject({ phase: 'work' });
    expect(await call('timer:pause')).toMatchObject({ paused: true });
    expect(await call('timer:resume')).toMatchObject({ paused: false });
    expect(await call('timer:skip')).toMatchObject({ phase: 'shortBreak' });
  });

  it('stop returns an idle snapshot', async () => {
    await call('timer:start', null);
    expect(await call('timer:stop')).toMatchObject({ phase: 'idle', remainingSeconds: 0 });
  });

  it('pause while idle is a harmless no-op', async () => {
    expect(await call('timer:pause')).toMatchObject({ phase: 'idle', paused: false });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter ./app exec vitest run tests/main/timer-ipc.test.ts`
Expected: FAIL (module `@main/ipc/timer.js` not found). If a failure instead comes from the `electron` mock shape not matching what `ipc/shared.ts` calls, adapt only the mock so it provides those members, and say so in the report.

- [ ] **Step 3: Implement**

Create `app/src/main/ipc/timer.ts`:

```ts
import { ipcMain } from 'electron';
import { eventBus } from '../events/bus.js';
import { sessionsRepo, settingsRepo } from '../store/index.js';
import { TimerService } from '../timer/service.js';
import { broadcast } from './shared.js';

export function registerTimerHandlers(): void {
  const service = new TimerService({
    getConfig: () => {
      const s = settingsRepo.getAll();
      return {
        workMinutes: s.workMinutes,
        shortBreakMinutes: s.shortBreakMinutes,
        longBreakMinutes: s.longBreakMinutes,
        blocksPerLongBreak: s.blocksPerLongBreak,
      };
    },
    sessions: sessionsRepo,
    bus: eventBus,
    now: Date.now,
  });

  eventBus.on('timer.changed', (snapshot) => broadcast('timer:changed', snapshot));
  eventBus.on('timer.work-block-completed', (payload) =>
    broadcast('timer:workBlockCompleted', payload),
  );

  ipcMain.handle('timer:start', async (_, taskId: string | null) => service.start(taskId));
  ipcMain.handle('timer:pause', async () => service.pause());
  ipcMain.handle('timer:resume', async () => service.resume());
  ipcMain.handle('timer:skip', async () => service.skip());
  ipcMain.handle('timer:stop', async () => service.stop());
  ipcMain.handle('timer:getSnapshot', async () => service.snapshot());
}
```

In `app/src/main/ipc/index.ts` add `import { registerTimerHandlers } from './timer.js';` with the other handler imports, and `registerTimerHandlers();` after `registerSummariesHandlers();` inside `setupIpcHandlers`.

In `app/src/preload/index.ts`:

- add `import { TimerSnapshot } from '../shared/timer.js';` under the existing shared import;
- add after the `CompanionApi` interface:

```ts
export interface TimerApi {
  start: (taskId: string | null) => Promise<TimerSnapshot>;
  pause: () => Promise<TimerSnapshot>;
  resume: () => Promise<TimerSnapshot>;
  skip: () => Promise<TimerSnapshot>;
  stop: () => Promise<TimerSnapshot>;
  getSnapshot: () => Promise<TimerSnapshot>;
}
```

- add `timer: TimerApi;` right after the `companion: CompanionApi;` line in `PloverApi`;
- add after the `companion: { ... },` block in the `api` object:

```ts
  timer: {
    start: (taskId) => ipcRenderer.invoke('timer:start', taskId),
    pause: () => ipcRenderer.invoke('timer:pause'),
    resume: () => ipcRenderer.invoke('timer:resume'),
    skip: () => ipcRenderer.invoke('timer:skip'),
    stop: () => ipcRenderer.invoke('timer:stop'),
    getSnapshot: () => ipcRenderer.invoke('timer:getSnapshot'),
  },
```

In `app/src/renderer/global.d.ts`: add `import type { TimerSnapshot } from '../shared/timer';` after the existing import, and add inside `PloverAPI` after `platform: string;`:

```ts
  timer: {
    start(taskId: string | null): Promise<TimerSnapshot>;
    pause(): Promise<TimerSnapshot>;
    resume(): Promise<TimerSnapshot>;
    skip(): Promise<TimerSnapshot>;
    stop(): Promise<TimerSnapshot>;
    getSnapshot(): Promise<TimerSnapshot>;
  };
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter ./app exec vitest run tests/main tests/timer`
Expected: PASS, including the existing `tests/main/ipc.test.ts`. If an existing test breaks because it counts registered handlers or asserts on `setupIpcHandlers`, report the exact assertion rather than editing it silently.

- [ ] **Step 5: Full gate and commit**

Run from repo root, echoing each exit code: `pnpm typecheck && pnpm lint && pnpm test`
Expected: all green; report the real totals.

```bash
git add app/src/main/ipc/timer.ts app/src/main/ipc/index.ts app/src/preload/index.ts app/src/renderer/global.d.ts app/tests/main/timer-ipc.test.ts
git commit -m "feat(timer): expose the pomodoro timer over IPC and preload

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

## Self-Review

- Spec coverage: §4.2 work/break/long-break defaults and start/pause/skip/stop (Tasks 1, 4, 5), configurable lengths (Task 3), completed sessions stored locally (Tasks 2, 4), buddy follows the timer via `timer.changed` / `timer:changed` snapshot (Tasks 4, 5), end-of-block check-in trigger via `timer.work-block-completed` / `timer:workBlockCompleted` (Tasks 4, 5). Not covered here by design: the check-in UI that ticks a step off through the existing `tasks:updateStatus` channel, buddy `working`/`break` visuals, and the Settings UI, all of which need M1's buddy shell.
- Placeholder scan: none; every code step has full code. The IPC and preload edits give exact anchor lines because those files are large and shared.
- Type consistency: `TimerConfig` field names equal the four `SettingsData` keys; `TimerSnapshot` is the same type in the service, the bus event, the IPC return, and the preload; `machine.*` names match their use in the service.
- Superseded work: the earlier branch `feat/buddy-session-foundations` (v1 spec) is parked, not merged. It also defines a migration v8 with different columns, so never merge both.
