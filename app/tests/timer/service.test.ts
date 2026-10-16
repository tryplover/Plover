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
  let tasks: TasksRepo;
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
    tasks = new TasksRepo(db);
    bus = new TypedEventBus();
    nowMs = T0;
    config = { workMinutes: 25, shortBreakMinutes: 5, longBreakMinutes: 15, blocksPerLongBreak: 4 };
    changed = [];
    completed = [];
    bus.on('timer.changed', (snapshot) => changed.push(snapshot));
    bus.on('timer.work-block-completed', (payload) => completed.push(payload));
    service = new TimerService({
      getConfig: () => config,
      sessions,
      bus,
      now: () => nowMs,
      taskExists: (id) => tasks.get(id) !== null,
    });
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
      plannedSeconds: 1500,
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
    const task = tasks.create({
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
    expect(snapshot).toMatchObject({ phase: 'shortBreak', blocksCompleted: 0, plannedSeconds: 300 });
    expect(sessions.list()).toHaveLength(0);
    expect(completed).toEqual([]);
  });

  it('stop returns to idle without recording and clears the interval', () => {
    vi.useFakeTimers();
    service.start(null);
    expect(vi.getTimerCount()).toBe(1);
    const snapshot = service.stop();
    expect(snapshot).toMatchObject({
      phase: 'idle',
      paused: false,
      remainingSeconds: 0,
      endsAt: null,
      plannedSeconds: 0,
    });
    expect(vi.getTimerCount()).toBe(0);
    expect(sessions.list()).toHaveLength(0);
  });

  it('keeps ticking when a timer.changed listener throws during start', () => {
    vi.useFakeTimers();
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    let thrown = false;
    bus.on('timer.changed', () => {
      if (!thrown) {
        thrown = true;
        throw new Error('listener failed');
      }
    });
    expect(() => service.start(null)).not.toThrow();
    expect(errorSpy).toHaveBeenCalledWith('[Timer] listener failed:', expect.any(Error));
    expect(vi.getTimerCount()).toBe(1);
    service.stop();
    expect(vi.getTimerCount()).toBe(0);
    errorSpy.mockRestore();
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

  it('records a block against a task deleted mid-block as unassigned', () => {
    const goal = new GoalsRepo(db).create({ title: 'Goal', status: 'active' });
    const task = tasks.create({
      goal_id: goal.id,
      title: 'Task',
      estimate_minutes: 30,
      status: 'todo',
    });
    service.start(task.id);
    advance(10 * MIN);
    tasks.delete(task.id);
    expect(() => advance(15 * MIN)).not.toThrow();
    const rows = sessions.list();
    expect(rows).toHaveLength(1);
    expect(rows[0]?.task_id).toBeNull();
    expect(completed).toEqual([{ blocksCompleted: 1, taskId: null, sessionId: rows[0]?.id }]);
    expect(service.snapshot().taskId).toBeNull();
  });

  it('treats a nonexistent task id as unassigned', () => {
    expect(service.start('does-not-exist').taskId).toBeNull();
    advance(25 * MIN);
    const rows = sessions.list();
    expect(rows).toHaveLength(1);
    expect(rows[0]?.task_id).toBeNull();
  });

  it('does not read the config on plain ticks and still ends the phase', () => {
    const getConfig = vi.fn(() => config);
    service = new TimerService({
      getConfig,
      sessions,
      bus,
      now: () => nowMs,
      taskExists: (id) => tasks.get(id) !== null,
    });
    service.start(null);
    expect(getConfig).toHaveBeenCalledTimes(1);
    advance(10 * SEC);
    service.pause();
    advance(10 * SEC);
    service.resume();
    expect(getConfig).toHaveBeenCalledTimes(1);
    advance(25 * MIN);
    expect(completed).toHaveLength(1);
    expect(sessions.list()).toHaveLength(1);
  });

  it('leaves no interval and stays idle when the config read throws on start', () => {
    vi.useFakeTimers();
    let failing = true;
    service = new TimerService({
      getConfig: () => {
        if (failing) throw new Error('bad settings');
        return config;
      },
      sessions,
      bus,
      now: () => nowMs,
      taskExists: () => false,
    });
    expect(() => service.start(null)).toThrow('bad settings');
    expect(vi.getTimerCount()).toBe(0);
    expect(service.snapshot().phase).toBe('idle');
    failing = false;
    expect(service.start(null).phase).toBe('work');
    expect(vi.getTimerCount()).toBe(1);
  });

  it('a backwards clock change keeps the remaining time unchanged', () => {
    service.start(null);
    advance(10 * MIN);
    const before = service.snapshot().remainingSeconds;
    nowMs -= 5 * MIN;
    service.tick();
    expect(Math.abs(service.snapshot().remainingSeconds - before)).toBeLessThanOrEqual(1);
  });

  it('a throwing listener does not stop the rest of the tick or the timer', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    bus.on('timer.work-block-completed', () => {
      throw new Error('listener boom');
    });
    service.start(null);
    changed.length = 0;
    expect(() => advance(25 * MIN)).not.toThrow();
    expect(errorSpy).toHaveBeenCalledWith('[Timer] listener failed:', expect.any(Error));
    expect(service.snapshot().phase).toBe('shortBreak');
    expect(service.snapshot().plannedSeconds).toBe(300);
    expect(changed.at(-1)?.phase).toBe('shortBreak');
    expect(completed).toHaveLength(1);
    advance(5 * MIN);
    expect(service.snapshot().phase).toBe('work');
    errorSpy.mockRestore();
  });
});
