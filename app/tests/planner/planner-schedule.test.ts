import { describe, expect, it } from 'vitest';
import { scheduleTasks } from '@main/planner/schedule';
import { Task } from '@shared/types';

function createTask(id: string, estimate_minutes: number, depends_on?: string[]): Task {
  return {
    id,
    goal_id: 'goal-1',
    title: `Task ${id}`,
    estimate_minutes,
    depends_on,
    status: 'todo',
    sort_index: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

describe('Deterministic Auto-Scheduling', () => {
  const workingHours = { start: '09:00', end: '17:00' };
  const horizonDays = 14;
  const baseDate = new Date('2026-05-24T10:00:00');

  it('schedules tasks sequentially when calendar is empty', async () => {
    const tasks = [createTask('t1', 60), createTask('t2', 120)];

    const result = await scheduleTasks({
      tasks,
      workingHours,
      horizonDays,
      now: baseDate,
    });

    expect(result).toHaveLength(2);

    const r1 = result.find((r) => r.taskId === 't1');
    const r2 = result.find((r) => r.taskId === 't2');

    expect(r1).toBeDefined();
    expect(r2).toBeDefined();
    if (!r1 || !r2) throw new Error('Tasks must be scheduled');

    expect(r1.start.toISOString()).toBe(new Date('2026-05-24T10:00:00').toISOString());
    expect(r1.end.toISOString()).toBe(new Date('2026-05-24T11:00:00').toISOString());

    expect(r2.start.toISOString()).toBe(new Date('2026-05-24T11:00:00').toISOString());
    expect(r2.end.toISOString()).toBe(new Date('2026-05-24T13:00:00').toISOString());
  });

  it('respects a diamond dependency graph', async () => {
    const tasks = [
      createTask('tD', 60, ['tB', 'tC']),
      createTask('tB', 60, ['tA']),
      createTask('tC', 60, ['tA']),
      createTask('tA', 60),
    ];

    const result = await scheduleTasks({
      tasks,
      workingHours,
      horizonDays,
      now: baseDate,
    });

    expect(result).toHaveLength(4);

    const rA = result.find((r) => r.taskId === 'tA');
    const rB = result.find((r) => r.taskId === 'tB');
    const rC = result.find((r) => r.taskId === 'tC');
    const rD = result.find((r) => r.taskId === 'tD');

    expect(rA).toBeDefined();
    expect(rB).toBeDefined();
    expect(rC).toBeDefined();
    expect(rD).toBeDefined();
    if (!rA || !rB || !rC || !rD) throw new Error('All tasks must be scheduled');

    expect(rA.start.toISOString()).toBe(new Date('2026-05-24T10:00:00').toISOString());
    expect(rA.end.toISOString()).toBe(new Date('2026-05-24T11:00:00').toISOString());

    expect(rB.start.getTime()).toBeGreaterThanOrEqual(rA.end.getTime());
    expect(rC.start.getTime()).toBeGreaterThanOrEqual(rA.end.getTime());

    if (rB.start.getTime() < rC.start.getTime()) {
      expect(rB.start.toISOString()).toBe(new Date('2026-05-24T11:00:00').toISOString());
      expect(rB.end.toISOString()).toBe(new Date('2026-05-24T12:00:00').toISOString());
      expect(rC.start.toISOString()).toBe(new Date('2026-05-24T12:00:00').toISOString());
      expect(rC.end.toISOString()).toBe(new Date('2026-05-24T13:00:00').toISOString());
    } else {
      expect(rC.start.toISOString()).toBe(new Date('2026-05-24T11:00:00').toISOString());
      expect(rC.end.toISOString()).toBe(new Date('2026-05-24T12:00:00').toISOString());
      expect(rB.start.toISOString()).toBe(new Date('2026-05-24T12:00:00').toISOString());
      expect(rB.end.toISOString()).toBe(new Date('2026-05-24T13:00:00').toISOString());
    }

    expect(rD.start.toISOString()).toBe(new Date('2026-05-24T13:00:00').toISOString());
    expect(rD.end.toISOString()).toBe(new Date('2026-05-24T14:00:00').toISOString());
  });

  it('pushes tasks to the next day if they straddle the working-hours boundary', async () => {
    const tasks = [createTask('t1', 120)];

    const result = await scheduleTasks({
      tasks,
      workingHours,
      horizonDays,
      now: new Date('2026-05-24T16:00:00'),
    });

    expect(result).toHaveLength(1);
    const r1 = result[0];
    expect(r1).toBeDefined();
    if (!r1) throw new Error('Task must be scheduled');

    expect(r1.start.toISOString()).toBe(new Date('2026-05-25T09:00:00').toISOString());
    expect(r1.end.toISOString()).toBe(new Date('2026-05-25T11:00:00').toISOString());
  });

  it('schedules a task larger than any single working-hours window contiguously', async () => {
    const tasks = [createTask('t1', 600)];

    const result = await scheduleTasks({
      tasks,
      workingHours,
      horizonDays,
      now: baseDate,
    });

    expect(result).toHaveLength(1);
    const r1 = result[0];
    expect(r1).toBeDefined();
    if (!r1) throw new Error('Task must be scheduled');

    expect(r1.start.toISOString()).toBe(new Date('2026-05-24T10:00:00').toISOString());
    expect(r1.end.toISOString()).toBe(new Date('2026-05-24T20:00:00').toISOString());
  });

  it('throws an error if a dependency cycle is detected', () => {
    const tasks = [createTask('t1', 60, ['t2']), createTask('t2', 60, ['t1'])];

    expect(() =>
      scheduleTasks({
        tasks,
          workingHours,
        horizonDays,
        now: baseDate,
      }),
    ).toThrow('Cycle detected in task dependencies');
  });

  it('throws on invalid workingHours format', () => {
    const tasks = [createTask('t1', 60)];

    expect(() =>
      scheduleTasks({
        tasks,
          workingHours: { start: 'oops', end: '17:00' },
        horizonDays,
        now: baseDate,
      }),
    ).toThrow(/workingHours\.start/);

    expect(() =>
      scheduleTasks({
        tasks,
          workingHours: { start: '09:00', end: '25:99' },
        horizonDays,
        now: baseDate,
      }),
    ).toThrow(/workingHours\.end/);
  });

  it('does not fail if a dependency is external or already completed (not in tasks list)', async () => {
    const tasks = [createTask('t1', 60, ['t0'])];

    const result = await scheduleTasks({
      tasks,
      workingHours,
      horizonDays,
      now: baseDate,
    });

    expect(result).toHaveLength(1);
    expect(result[0]?.taskId).toBe('t1');
  });

  it('leaves a task unscheduled if its dependency could not be scheduled', async () => {
    const tasks = [createTask('t1', 20 * 24 * 60), createTask('t2', 60, ['t1'])];

    const result = await scheduleTasks({
      tasks,
      workingHours,
      horizonDays: 1,
      now: baseDate,
    });

    expect(result).toHaveLength(0);
  });

  it('skips day if minStartTime is after working hours end', async () => {
    const tasks = [createTask('t1', 600), createTask('t2', 60, ['t1'])];

    const result = await scheduleTasks({
      tasks,
      workingHours,
      horizonDays,
      now: baseDate,
    });

    const r2 = result.find((r) => r.taskId === 't2');
    expect(r2).toBeDefined();
    if (!r2) throw new Error('Task must be scheduled');

    expect(r2.start.toISOString()).toBe(new Date('2026-05-25T09:00:00').toISOString());
    expect(r2.end.toISOString()).toBe(new Date('2026-05-25T10:00:00').toISOString());
  });
});
