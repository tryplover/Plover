import { describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import { runMigrations } from '@main/store/db.js';
import { TasksRepo } from '@main/store/repos/tasks.js';
import { GoalsRepo } from '@main/store/repos/goals.js';

describe('TasksRepo', () => {
  const setup = () => {
    const db = new Database(':memory:');
    db.pragma('foreign_keys = ON');
    runMigrations(db);
    const goalsRepo = new GoalsRepo(db);
    const tasksRepo = new TasksRepo(db);
    return { db, goalsRepo, tasksRepo };
  };

  const seedGoal = (goalsRepo: GoalsRepo) => {
    return goalsRepo.create({ title: 'Test Goal', status: 'active' });
  };

  it('creates and retrieves a task with depends_on serialization', () => {
    const { goalsRepo, tasksRepo } = setup();
    const goal = seedGoal(goalsRepo);

    const task = tasksRepo.create({
      goal_id: goal.id,
      title: 'Task 1',
      estimate_minutes: 30,
      status: 'todo',
      depends_on: ['other-task-id'],
      scheduled_start: '2026-05-24T10:00:00Z',
      scheduled_end: '2026-05-24T10:30:00Z',
      calendar_event_id: 'cal-123',
    });

    expect(task.id).toBeDefined();
    expect(task.goal_id).toBe(goal.id);
    expect(task.title).toBe('Task 1');
    expect(task.depends_on).toEqual(['other-task-id']);
    expect(task.scheduled_start).toBe('2026-05-24T10:00:00Z');
    expect(task.scheduled_end).toBe('2026-05-24T10:30:00Z');
    expect(task.calendar_event_id).toBe('cal-123');

    const retrieved = tasksRepo.get(task.id);
    expect(retrieved).toEqual(task);
  });

  it('returns null for non-existent task', () => {
    const { tasksRepo } = setup();
    expect(tasksRepo.get('non-existent')).toBeNull();
  });

  it('updates a task and maintains updated_at monotonicity', async () => {
    const { goalsRepo, tasksRepo } = setup();
    const goal = seedGoal(goalsRepo);
    const task = tasksRepo.create({
      goal_id: goal.id,
      title: 'Original Title',
      estimate_minutes: 30,
      status: 'todo',
    });
    const originalUpdatedAt = task.updated_at;

    await new Promise(resolve => setTimeout(resolve, 10));

    const updated = tasksRepo.update(task.id, {
      title: 'Updated Title',
      status: 'scheduled',
      depends_on: ['new-dep'],
    });

    expect(updated.title).toBe('Updated Title');
    expect(updated.status).toBe('scheduled');
    expect(updated.depends_on).toEqual(['new-dep']);
    expect(new Date(updated.updated_at).getTime()).toBeGreaterThan(new Date(originalUpdatedAt).getTime());

    const retrieved = tasksRepo.get(task.id);
    expect(retrieved?.title).toBe('Updated Title');
    expect(retrieved?.status).toBe('scheduled');
    expect(retrieved?.depends_on).toEqual(['new-dep']);
  });

  it('lists tasks by goal', () => {
    const { goalsRepo, tasksRepo } = setup();
    const goal1 = seedGoal(goalsRepo);
    const goal2 = goalsRepo.create({ title: 'Goal 2', status: 'active' });

    tasksRepo.create({ goal_id: goal1.id, title: 'G1 T1', estimate_minutes: 10, status: 'todo' });
    tasksRepo.create({ goal_id: goal1.id, title: 'G1 T2', estimate_minutes: 10, status: 'todo' });
    tasksRepo.create({ goal_id: goal2.id, title: 'G2 T1', estimate_minutes: 10, status: 'todo' });

    const g1Tasks = tasksRepo.listByGoal(goal1.id);
    expect(g1Tasks).toHaveLength(2);
    expect(g1Tasks.every(t => t.goal_id === goal1.id)).toBe(true);

    const g2Tasks = tasksRepo.listByGoal(goal2.id);
    expect(g2Tasks).toHaveLength(1);
    const [gt0] = g2Tasks;
    expect(gt0?.title).toBe('G2 T1');
  });

  it('lists all tasks', () => {
    const { goalsRepo, tasksRepo } = setup();
    const goal = seedGoal(goalsRepo);
    tasksRepo.create({ goal_id: goal.id, title: 'T1', estimate_minutes: 10, status: 'todo' });
    tasksRepo.create({ goal_id: goal.id, title: 'T2', estimate_minutes: 10, status: 'todo' });

    expect(tasksRepo.list()).toHaveLength(2);
  });

  describe('listScheduledBetween', () => {
    it('returns tasks within the range and overdue tasks', () => {
      const { goalsRepo, tasksRepo } = setup();
      const goal = seedGoal(goalsRepo);

      // Task in range
      const inRange = tasksRepo.create({
        goal_id: goal.id,
        title: 'In Range',
        estimate_minutes: 30,
        status: 'todo',
        scheduled_start: new Date('2026-05-24T10:30:00Z').toISOString(),
      });

      // Task on start boundary
      const onStart = tasksRepo.create({
        goal_id: goal.id,
        title: 'On Start',
        estimate_minutes: 30,
        status: 'todo',
        scheduled_start: new Date('2026-05-24T10:00:00Z').toISOString(),
      });

      // Task on end boundary
      const onEnd = tasksRepo.create({
        goal_id: goal.id,
        title: 'On End',
        estimate_minutes: 30,
        status: 'todo',
        scheduled_start: new Date('2026-05-24T11:00:00Z').toISOString(),
      });

      // Overdue task (before range, not done/skipped)
      const overdue = tasksRepo.create({
        goal_id: goal.id,
        title: 'Overdue',
        estimate_minutes: 30,
        status: 'scheduled',
        scheduled_start: new Date('2026-05-24T09:00:00Z').toISOString(),
      });

      // Task before range but DONE (should be excluded)
      tasksRepo.create({
        goal_id: goal.id,
        title: 'Before but Done',
        estimate_minutes: 30,
        status: 'done',
        scheduled_start: new Date('2026-05-24T09:00:00Z').toISOString(),
      });

      // Task after range (should be excluded)
      tasksRepo.create({
        goal_id: goal.id,
        title: 'After Range',
        estimate_minutes: 30,
        status: 'todo',
        scheduled_start: new Date('2026-05-24T11:00:01Z').toISOString(),
      });

      const start = new Date('2026-05-24T10:00:00Z');
      const end = new Date('2026-05-24T11:00:00Z');
      const results = tasksRepo.listScheduledBetween(start, end);

      expect(results).toHaveLength(4);
      const ids = results.map(t => t.id);
      expect(ids).toContain(inRange.id);
      expect(ids).toContain(onStart.id);
      expect(ids).toContain(onEnd.id);
      expect(ids).toContain(overdue.id);
    });
  });

  it('lists active scheduled before a certain time', () => {
    const { goalsRepo, tasksRepo } = setup();
    const goal = seedGoal(goalsRepo);

    // Should be included: active and ended before 'now'
    const included = tasksRepo.create({
      goal_id: goal.id,
      title: 'Included',
      estimate_minutes: 30,
      status: 'scheduled',
      scheduled_start: '2026-05-24T08:00:00Z',
      scheduled_end: '2026-05-24T08:30:00Z',
    });

    // Should be excluded: done
    tasksRepo.create({
      goal_id: goal.id,
      title: 'Done',
      estimate_minutes: 30,
      status: 'done',
      scheduled_start: '2026-05-24T08:00:00Z',
      scheduled_end: '2026-05-24T08:30:00Z',
    });

    // Should be excluded: ends after 'now'
    tasksRepo.create({
      goal_id: goal.id,
      title: 'Ends later',
      estimate_minutes: 30,
      status: 'scheduled',
      scheduled_start: '2026-05-24T08:30:00Z',
      scheduled_end: '2026-05-24T09:30:00Z',
    });

    const now = new Date('2026-05-24T09:00:00Z');
    const results = tasksRepo.listActiveScheduledBefore(now);

    expect(results).toHaveLength(1);
    const [r0] = results;
    expect(r0?.id).toBe(included.id);
  });
});
