import { describe, it, expect, vi } from 'vitest';
import Database from 'better-sqlite3';
import { runMigrations } from '@main/store/db.js';
import { TasksRepo } from '@main/store/repos/tasks.js';
import { GoalsRepo } from '@main/store/repos/goals.js';
import { ActivityRepo } from '@main/store/repos/activity.js';
import { SettingsRepo } from '@main/store/repos/settings.js';
import { DeviationDetector, type CalendarPort } from '@main/planner/deviation-detector.js';

const NOW = new Date('2026-06-12T18:00:00.000Z');

function freshHarness(): {
  db: Database.Database;
  tasksRepo: TasksRepo;
  goalsRepo: GoalsRepo;
  activityRepo: ActivityRepo;
  settingsRepo: SettingsRepo;
  calendar: CalendarPort & {
    listEvents: ReturnType<typeof vi.fn>;
    createEvent: ReturnType<typeof vi.fn>;
    deleteEvent: ReturnType<typeof vi.fn>;
  };
  notifySpy: ReturnType<typeof vi.fn>;
  detector: DeviationDetector;
} {
  const db = new Database(':memory:');
  runMigrations(db);
  const tasksRepo = new TasksRepo(db);
  const goalsRepo = new GoalsRepo(db);
  const activityRepo = new ActivityRepo(db);
  const settingsRepo = new SettingsRepo(db);
  settingsRepo.update({
    workingHours: { start: '09:00', end: '18:00' },
    horizonDays: 14,
  });

  const calendar = {
    listEvents: vi.fn<CalendarPort['listEvents']>().mockResolvedValue([]),
    createEvent: vi.fn<CalendarPort['createEvent']>().mockResolvedValue('new-event-id'),
    deleteEvent: vi.fn<CalendarPort['deleteEvent']>().mockResolvedValue(undefined),
  };
  const notifySpy = vi.fn();
  const detector = new DeviationDetector(
    tasksRepo,
    activityRepo,
    settingsRepo,
    calendar,
    notifySpy,
    () => NOW,
  );

  return { db, tasksRepo, goalsRepo, activityRepo, settingsRepo, calendar, notifySpy, detector };
}

function seedScheduledTask(
  goalsRepo: GoalsRepo,
  tasksRepo: TasksRepo,
  title: string,
  scheduledStart: string,
  scheduledEnd: string,
  calendarEventId: string | undefined = 'old-event-id',
): { taskId: string } {
  const goal = goalsRepo.create({ title: 'Test goal', status: 'active' });
  const task = tasksRepo.create({
    goal_id: goal.id,
    title,
    estimate_minutes: 60,
    status: 'scheduled',
    depends_on: [],
    scheduled_start: scheduledStart,
    scheduled_end: scheduledEnd,
    calendar_event_id: calendarEventId,
  });
  return { taskId: task.id };
}

describe('DeviationDetector.checkCompletedBlocks', () => {
  it('flags a past scheduled task with no activity in the window as AFK-missed', () => {
    const { detector, tasksRepo, goalsRepo } = freshHarness();
    seedScheduledTask(
      goalsRepo,
      tasksRepo,
      'Write report',
      '2026-06-12T10:00:00.000Z',
      '2026-06-12T11:00:00.000Z',
    );

    const missed = detector.checkCompletedBlocks();
    expect(missed).toHaveLength(1);
    const [m0] = missed;
    expect(m0?.task.title).toBe('Write report');
    expect(m0?.reason).toBe('afk');
    expect(m0?.evidenceCount).toBe(0);
  });

  it('does not flag a task whose window contains activity', () => {
    const { detector, tasksRepo, goalsRepo, activityRepo } = freshHarness();
    seedScheduledTask(
      goalsRepo,
      tasksRepo,
      'Real work',
      '2026-06-12T10:00:00.000Z',
      '2026-06-12T11:00:00.000Z',
    );
    activityRepo.insert({
      kind: 'file_modified',
      payload: { path: '/src/x.ts' },
      ts: '2026-06-12T10:30:00.000Z',
    });

    expect(detector.checkCompletedBlocks()).toHaveLength(0);
  });

  it('ignores tasks whose end is still in the future', () => {
    const { detector, tasksRepo, goalsRepo } = freshHarness();
    seedScheduledTask(
      goalsRepo,
      tasksRepo,
      'Future block',
      '2026-06-12T20:00:00.000Z',
      '2026-06-12T21:00:00.000Z',
    );

    expect(detector.checkCompletedBlocks()).toHaveLength(0);
  });

  it('ignores tasks already marked done', () => {
    const { detector, tasksRepo, goalsRepo } = freshHarness();
    const { taskId } = seedScheduledTask(
      goalsRepo,
      tasksRepo,
      'Already done',
      '2026-06-12T10:00:00.000Z',
      '2026-06-12T11:00:00.000Z',
    );
    tasksRepo.update(taskId, { status: 'done' });

    expect(detector.checkCompletedBlocks()).toHaveLength(0);
  });

  it('ignores unscheduled tasks', () => {
    const { detector, tasksRepo, goalsRepo } = freshHarness();
    const goal = goalsRepo.create({ title: 'g', status: 'active' });
    tasksRepo.create({
      goal_id: goal.id,
      title: 'Unscheduled',
      estimate_minutes: 30,
      status: 'todo',
      depends_on: [],
    });

    expect(detector.checkCompletedBlocks()).toHaveLength(0);
  });
});

describe('DeviationDetector.rescheduleTask', () => {
  it('deletes the old calendar event, picks a new slot, creates a new event, updates the task, and notifies', async () => {
    const { detector, tasksRepo, goalsRepo, calendar, notifySpy } = freshHarness();
    const { taskId } = seedScheduledTask(
      goalsRepo,
      tasksRepo,
      'Slide me',
      '2026-06-12T10:00:00.000Z',
      '2026-06-12T11:00:00.000Z',
    );

    const task = tasksRepo.get(taskId);
    expect(task).toBeDefined();
    if (!task) throw new Error('task missing');
    const result = await detector.rescheduleTask(task);

    expect(calendar.deleteEvent).toHaveBeenCalledWith('old-event-id');
    expect(calendar.listEvents).toHaveBeenCalledTimes(1);
    expect(calendar.createEvent).toHaveBeenCalledTimes(1);
    const createArg = calendar.createEvent.mock.calls[0]?.[0];
    expect(createArg?.taskId).toBe(taskId);
    expect(createArg?.title).toBe('Slide me');

    expect(result).not.toBeNull();
    const updated = tasksRepo.get(taskId);
    expect(updated?.calendar_event_id).toBe('new-event-id');
    expect(updated?.scheduled_start).toBe(result?.start.toISOString());
    expect(updated?.scheduled_end).toBe(result?.end.toISOString());
    expect(notifySpy).toHaveBeenCalledTimes(1);
  });

  it('returns null and does not update the task when listEvents fails', async () => {
    const { detector, tasksRepo, goalsRepo, calendar } = freshHarness();
    const { taskId } = seedScheduledTask(
      goalsRepo,
      tasksRepo,
      'Doomed',
      '2026-06-12T10:00:00.000Z',
      '2026-06-12T11:00:00.000Z',
      'old-event-id',
    );
    calendar.listEvents.mockRejectedValue(new Error('gcal down'));

    const task = tasksRepo.get(taskId);
    if (!task) throw new Error('task missing');
    const result = await detector.rescheduleTask(task);

    expect(result).toBeNull();
    expect(calendar.createEvent).not.toHaveBeenCalled();
    const after = tasksRepo.get(taskId);
    expect(after?.calendar_event_id).toBe('old-event-id');
    expect(after?.scheduled_start).toBe('2026-06-12T10:00:00.000Z');
  });

  it('runDeviationPass reschedules every missed block', async () => {
    const { detector, tasksRepo, goalsRepo, calendar } = freshHarness();
    seedScheduledTask(
      goalsRepo,
      tasksRepo,
      'Block A',
      '2026-06-12T09:00:00.000Z',
      '2026-06-12T10:00:00.000Z',
      'event-a',
    );
    seedScheduledTask(
      goalsRepo,
      tasksRepo,
      'Block B',
      '2026-06-12T11:00:00.000Z',
      '2026-06-12T12:00:00.000Z',
      'event-b',
    );
    calendar.createEvent.mockResolvedValueOnce('new-a').mockResolvedValueOnce('new-b');

    await detector.runDeviationPass();

    expect(calendar.deleteEvent).toHaveBeenCalledTimes(2);
    expect(calendar.createEvent).toHaveBeenCalledTimes(2);
  });

  it('runDeviationPass preserves task dependencies during rescheduling and calls listEvents once', async () => {
    const { detector, tasksRepo, goalsRepo, calendar } = freshHarness();
    const goal = goalsRepo.create({ title: 'Goal', status: 'active' });

    const taskA = tasksRepo.create({
      goal_id: goal.id,
      title: 'Task A',
      estimate_minutes: 60,
      status: 'scheduled',
      depends_on: [],
      scheduled_start: '2026-06-12T09:00:00.000Z',
      scheduled_end: '2026-06-12T10:00:00.000Z',
      calendar_event_id: 'event-a',
    });

    const taskB = tasksRepo.create({
      goal_id: goal.id,
      title: 'Task B',
      estimate_minutes: 60,
      status: 'scheduled',
      depends_on: [taskA.id],
      scheduled_start: '2026-06-12T10:00:00.000Z',
      scheduled_end: '2026-06-12T11:00:00.000Z',
      calendar_event_id: 'event-b',
    });

    calendar.createEvent.mockResolvedValueOnce('new-event-a').mockResolvedValueOnce('new-event-b');

    await detector.runDeviationPass();

    expect(calendar.listEvents).toHaveBeenCalledTimes(1);

    const updatedA = tasksRepo.get(taskA.id);
    const updatedB = tasksRepo.get(taskB.id);

    expect(updatedA?.scheduled_start).toBeDefined();
    expect(updatedB?.scheduled_start).toBeDefined();

    if (updatedA?.scheduled_end && updatedB?.scheduled_start) {
      const endA = new Date(updatedA.scheduled_end);
      const startB = new Date(updatedB.scheduled_start);
      expect(startB.getTime()).toBeGreaterThanOrEqual(endA.getTime());
    } else {
      throw new Error('Scheduled start or end is missing');
    }
  });
});
