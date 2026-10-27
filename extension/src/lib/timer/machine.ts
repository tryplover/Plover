import type {
  RunningPhase,
  TimerConfig,
  TimerEvent,
  TimerState,
  TimerTransition,
} from "./types";

export const IDLE_TIMER: TimerState = {
  phase: "idle",
  phaseEndsAt: 0,
  blocksCompleted: 0,
  pausedAt: null,
};

function isRunning(state: TimerState): boolean {
  return state.phase !== "idle";
}

function plannedSeconds(phase: RunningPhase, config: TimerConfig): number {
  if (phase === "work") return config.workMinutes * 60;
  if (phase === "shortBreak") return config.shortBreakMinutes * 60;
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
    state: {
      phase,
      phaseEndsAt: nowMs + seconds * 1000,
      blocksCompleted,
      pausedAt: null,
    },
    event: {
      type: "phase-started",
      phase,
      plannedSeconds: seconds,
      blocksCompleted,
    },
  };
}

export function startTimer(
  config: TimerConfig,
  nowMs: number,
): TimerTransition {
  const { state, event } = beginPhase("work", 0, config, nowMs);
  return { state, events: [event] };
}

// One tick makes at most one transition so a tick delayed by sleep never replays missed phases.
function advance(
  state: TimerState,
  config: TimerConfig,
  nowMs: number,
): TimerTransition {
  if (state.phase === "work") {
    const blocksCompleted = state.blocksCompleted + 1;
    const next: RunningPhase =
      blocksCompleted % config.blocksPerLongBreak === 0
        ? "longBreak"
        : "shortBreak";
    const { state: nextState, event } = beginPhase(
      next,
      blocksCompleted,
      config,
      nowMs,
    );
    return {
      state: nextState,
      events: [{ type: "work-block-completed", blocksCompleted }, event],
    };
  }
  const { state: nextState, event } = beginPhase(
    "work",
    state.blocksCompleted,
    config,
    nowMs,
  );
  return { state: nextState, events: [event] };
}

export function tick(
  state: TimerState,
  config: TimerConfig,
  nowMs: number,
): TimerTransition {
  if (
    !isRunning(state) ||
    state.pausedAt !== null ||
    nowMs < state.phaseEndsAt
  ) {
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
    state: {
      ...state,
      pausedAt: null,
      phaseEndsAt: state.phaseEndsAt + pausedFor,
    },
    events: [],
  };
}

export function skipPhase(
  state: TimerState,
  config: TimerConfig,
  nowMs: number,
): TimerTransition {
  if (!isRunning(state)) {
    return { state, events: [] };
  }
  const next: RunningPhase = state.phase === "work" ? "shortBreak" : "work";
  const { state: nextState, event } = beginPhase(
    next,
    state.blocksCompleted,
    config,
    nowMs,
  );
  return { state: nextState, events: [event] };
}

export function stopTimer(state: TimerState): TimerTransition {
  if (!isRunning(state)) {
    return { state, events: [] };
  }
  return {
    state: IDLE_TIMER,
    events: [{ type: "stopped", blocksCompleted: state.blocksCompleted }],
  };
}

export function delayPhase(state: TimerState, byMs: number): TimerTransition {
  if (!isRunning(state) || state.pausedAt !== null) {
    return { state, events: [] };
  }
  return {
    state: { ...state, phaseEndsAt: state.phaseEndsAt + byMs },
    events: [],
  };
}

export function remainingSeconds(state: TimerState, nowMs: number): number {
  if (!isRunning(state)) return 0;
  const reference = state.pausedAt ?? nowMs;
  return Math.max(0, Math.ceil((state.phaseEndsAt - reference) / 1000));
}
