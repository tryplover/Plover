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
  taskExists: (id: string) => boolean;
}

export class TimerService {
  private state: TimerState = machine.IDLE_TIMER;
  private taskId: string | null = null;
  private blockStartedAt = 0;
  private blockPlannedSeconds = 0;
  private phasePlannedSeconds = 0;
  private lastTickAt = 0;
  private interval: ReturnType<typeof setInterval> | null = null;

  constructor(private deps: TimerServiceDeps) {}

  start(taskId: string | null): TimerSnapshot {
    if (this.state.phase !== 'idle') return this.snapshot();
    const now = this.deps.now();
    this.taskId = taskId !== null && this.deps.taskExists(taskId) ? taskId : null;
    this.lastTickAt = now;
    const config = this.deps.getConfig();
    this.interval = setInterval(() => this.tick(), TICK_MS);
    this.apply(machine.startTimer(config, now));
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
    if (gap > SUSPEND_GAP_MS || gap < 0) {
      this.apply(machine.delayPhase(this.state, gap));
      return;
    }
    if (this.state.phase === 'idle' || this.state.pausedAt !== null || now < this.state.phaseEndsAt) return;
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
      plannedSeconds: this.phasePlannedSeconds,
    };
  }

  private apply(transition: TimerTransition): void {
    const changed = transition.state !== this.state || transition.events.length > 0;
    this.state = transition.state;
    for (const event of transition.events) this.guarded(() => this.handle(event));
    if (changed) this.guarded(() => this.deps.bus.emit('timer.changed', this.snapshot()));
  }

  private guarded(fn: () => void): void {
    try {
      fn();
    } catch (err) {
      console.error('[Timer] listener failed:', err);
    }
  }

  private handle(event: TimerEvent): void {
    const now = this.deps.now();
    if (event.type === 'phase-started') {
      this.phasePlannedSeconds = event.plannedSeconds;
      if (event.phase === 'work') {
        this.blockStartedAt = now;
        this.blockPlannedSeconds = event.plannedSeconds;
      }
    } else if (event.type === 'work-block-completed') {
      const taskId = this.taskId !== null && this.deps.taskExists(this.taskId) ? this.taskId : null;
      this.taskId = taskId;
      const session = this.deps.sessions.create({
        task_id: taskId,
        started_at: new Date(this.blockStartedAt).toISOString(),
        ended_at: new Date(now).toISOString(),
        phase: 'work',
        planned_seconds: this.blockPlannedSeconds,
      });
      this.guarded(() =>
        this.deps.bus.emit('timer.work-block-completed', {
          blocksCompleted: event.blocksCompleted,
          taskId,
          sessionId: session.id,
        }),
      );
    } else if (event.type === 'stopped') {
      this.clearInterval();
      this.taskId = null;
      this.phasePlannedSeconds = 0;
    }
  }

  private clearInterval(): void {
    if (this.interval !== null) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }
}
