import { describe, expect, it } from 'vitest';
import { mockDecomposeGoal } from '../src/main/planner/decompose-mock';
import { scheduleTasksLocal } from '../src/main/planner/schedule-mock';
import { CalendarEvent } from '../src/shared/types';

describe('Planner Subtask Decomposer', () => {
  it('decomposes a general goal into generic steps', () => {
    const result = mockDecomposeGoal('Learn origami');
    expect(result.goal.title).toBe('Learn origami');
    expect(result.subtasks).toHaveLength(4);
    expect(result.subtasks[0]?.title).toBe('Initial research & outline');
  });

  it('customizes steps for code/programming goals', () => {
    const result = mockDecomposeGoal('Build a WebGL renderer');
    expect(result.subtasks).toHaveLength(5);
    const firstTitle = result.subtasks[0]?.title ?? '';
    const hasExpectedKeywords =
      firstTitle.includes('database schema') ||
      firstTitle.includes('Design') ||
      firstTitle.includes('structure');
    expect(hasExpectedKeywords).toBe(true);
  });

  it('establishes sequential dependencies among subtasks', () => {
    const result = mockDecomposeGoal('Write an essay');
    expect(result.subtasks[0]?.depends_on).toEqual([]);
    expect(result.subtasks[1]?.depends_on).toEqual(['temp-task-0']);
  });
});

describe('Planner Scheduler', () => {
  const workingHours = { start: '09:00', end: '17:00' };

  it('schedules tasks within working hours', () => {
    const tasks = [
      { id: 't1', title: 'Task 1', estimate_minutes: 60, depends_on: [] },
      { id: 't2', title: 'Task 2', estimate_minutes: 120, depends_on: [] },
    ];

    const slots = scheduleTasksLocal(tasks, [], workingHours, 7);
    expect(slots).toHaveLength(2);

    for (const slot of slots) {
      const start = new Date(slot.start);
      const end = new Date(slot.end);

      expect(start.getHours()).toBeGreaterThanOrEqual(9);
      expect(end.getHours() * 60 + end.getMinutes()).toBeLessThanOrEqual(17 * 60);
    }
  });

  it('respects depends_on dependencies sequentially', () => {
    const tasks = [
      { id: 't1', title: 'Task 1', estimate_minutes: 60, depends_on: [] },
      { id: 't2', title: 'Task 2', estimate_minutes: 60, depends_on: ['t1'] },
    ];

    const slots = scheduleTasksLocal(tasks, [], workingHours, 7);
    const slot1 = slots.find((s) => s.taskId === 't1');
    const slot2 = slots.find((s) => s.taskId === 't2');

    expect(slot1).toBeDefined();
    expect(slot2).toBeDefined();

    const end1 = new Date(slot1?.end ?? 0);
    const start2 = new Date(slot2?.start ?? 0);

    expect(start2.getTime()).toBeGreaterThanOrEqual(end1.getTime());
  });

  it('skips occupied calendar event time slots', () => {
    const tasks = [{ id: 't1', title: 'Task 1', estimate_minutes: 60, depends_on: [] }];

    const now = new Date();
    now.setHours(9, 30, 0, 0);

    const eventStart = new Date(now);
    const eventEnd = new Date(now.getTime() + 120 * 60 * 1000);

    const calendarEvents: CalendarEvent[] = [
      {
        id: 'c1',
        summary: 'Busy Meeting',
        start: eventStart.toISOString(),
        end: eventEnd.toISOString(),
      },
    ];

    const slots = scheduleTasksLocal(tasks, calendarEvents, workingHours, 7);
    expect(slots).toHaveLength(1);

    const slot = slots[0];
    expect(slot).toBeDefined();
    if (!slot) return;
    const slotStart = new Date(slot.start);
    const slotEnd = new Date(slot.end);

    const overlaps = slotStart < eventEnd && slotEnd > eventStart;
    expect(overlaps).toBe(false);
  });
});
