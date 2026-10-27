export type TimerPhase = "idle" | "work" | "shortBreak" | "longBreak";
export type RunningPhase = Exclude<TimerPhase, "idle">;

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
  | {
      type: "phase-started";
      phase: RunningPhase;
      plannedSeconds: number;
      blocksCompleted: number;
    }
  | { type: "work-block-completed"; blocksCompleted: number }
  | { type: "stopped"; blocksCompleted: number };

export interface TimerTransition {
  state: TimerState;
  events: TimerEvent[];
}
