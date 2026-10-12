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
