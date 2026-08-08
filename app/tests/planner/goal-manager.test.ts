import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('electron', () => ({
  app: { isPackaged: false },
}));

import { db, goalsRepo, tasksRepo } from '../../src/main/store';
import { eventBus } from '../../src/main/events/bus';
import { saveGoalAndTasks, deleteGoalAndTasks } from '../../src/main/planner/goal-manager';

function countRows(table: 'goals' | 'tasks'): number {
  return (db.prepare(`SELECT COUNT(*) as c FROM ${table}`).get() as { c: number }).c;
}

describe('saveGoalAndTasks', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('creates the goal and all subtasks together, wiring dependency indices to real task ids', async () => {
    const emitSpy = vi.spyOn(eventBus, 'emit');

    const result = await saveGoalAndTasks(
      { title: 'Learn French', description: 'Basics', deadline: undefined },
      [
        { title: 'Learn alphabet', estimate_minutes: 30 },
        { title: 'Learn greetings', estimate_minutes: 45, depends_on: ['0'] },
      ],
      [],
    );

    expect(result.goal.title).toBe('Learn French');
    expect(result.tasks).toHaveLength(2);

    const persistedGoal = goalsRepo.get(result.goal.id);
    expect(persistedGoal).toEqual(result.goal);

    const persistedTasks = tasksRepo.listByGoal(result.goal.id);
    expect(persistedTasks).toHaveLength(2);
    const second = persistedTasks.find((t) => t.title === 'Learn greetings');
    const first = persistedTasks.find((t) => t.title === 'Learn alphabet');
    expect(second?.depends_on).toEqual([first?.id]);

    expect(emitSpy).toHaveBeenCalledWith(
      'goal.created',
      expect.objectContaining({ id: result.goal.id }),
    );
  });

  it('rolls back the goal and every subtask when a task insert fails partway through', async () => {
    const before = { goals: countRows('goals'), tasks: countRows('tasks') };
    const emitSpy = vi.spyOn(eventBus, 'emit');

    const originalCreate = tasksRepo.create.bind(tasksRepo);
    let callCount = 0;
    vi.spyOn(tasksRepo, 'create').mockImplementation((...args) => {
      callCount += 1;
      if (callCount === 2) {
        throw new Error('simulated task insert failure');
      }
      return originalCreate(...args);
    });

    await expect(
      saveGoalAndTasks(
        { title: 'Doomed goal', description: '', deadline: undefined },
        [
          { title: 'Step 1', estimate_minutes: 15 },
          { title: 'Step 2', estimate_minutes: 15 },
        ],
        [],
      ),
    ).rejects.toThrow('simulated task insert failure');

    expect(countRows('goals')).toBe(before.goals);
    expect(countRows('tasks')).toBe(before.tasks);
    expect(emitSpy).not.toHaveBeenCalledWith('goal.created', expect.anything());
  });
});

describe('deleteGoalAndTasks', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('deletes the goal and all of its tasks together', async () => {
    const { goal } = await saveGoalAndTasks(
      { title: 'Goal to delete', description: '', deadline: undefined },
      [{ title: 'Only task', estimate_minutes: 10 }],
      [],
    );

    await deleteGoalAndTasks(goal.id);

    expect(goalsRepo.get(goal.id)).toBeNull();
    expect(tasksRepo.listByGoal(goal.id)).toHaveLength(0);
  });

  it('leaves tasks and goal untouched when the goal delete step fails', async () => {
    const { goal } = await saveGoalAndTasks(
      { title: 'Goal that resists deletion', description: '', deadline: undefined },
      [{ title: 'Stubborn task', estimate_minutes: 10 }],
      [],
    );
    const emitSpy = vi.spyOn(eventBus, 'emit');

    vi.spyOn(goalsRepo, 'delete').mockImplementation(() => {
      throw new Error('simulated goal delete failure');
    });

    await expect(deleteGoalAndTasks(goal.id)).rejects.toThrow('simulated goal delete failure');

    expect(goalsRepo.get(goal.id)).toEqual(goal);
    expect(tasksRepo.listByGoal(goal.id)).toHaveLength(1);
    expect(emitSpy).not.toHaveBeenCalledWith('goal.deleted', expect.anything());
  });
});
