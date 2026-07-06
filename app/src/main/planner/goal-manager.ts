import { randomUUID } from 'node:crypto';
import { Goal, Task, SummaryRow } from '../../shared/types.js';
import { goalsRepo, tasksRepo, settingsRepo } from '../store/index.js';
import { eventBus } from '../bus.js';
import { GoogleCalendarSync } from '../sync/calendar.js';

export async function saveGoalAndTasks(
  goalInput: Omit<Goal, 'id' | 'created_at' | 'updated_at' | 'status'>,
  subtaskInputs: Omit<
    Task,
    | 'id'
    | 'goal_id'
    | 'status'
    | 'created_at'
    | 'updated_at'
    | 'scheduled_start'
    | 'scheduled_end'
    | 'calendar_event_id'
  >[],
  scheduledSlots: { tempIndex: number; start: string; end: string }[],
  calendarSync: GoogleCalendarSync,
) {
  const goal = goalsRepo.create({
    title: goalInput.title,
    description: goalInput.description || '',
    deadline: goalInput.deadline,
    status: 'active',
  });

  const isGoogleConnected = settingsRepo.getAll().googleConnected;
  const taskIds: string[] = subtaskInputs.map(() => randomUUID());

  const prepared = subtaskInputs.map((taskInput, index) => {
    const taskId = taskIds[index] ?? randomUUID();
    const slot = scheduledSlots.find((s) => s.tempIndex === index);

    const depends_on: string[] = [];
    if (Array.isArray(taskInput.depends_on)) {
      for (const depStr of taskInput.depends_on) {
        const depIdx = parseInt(depStr, 10);
        const depId = taskIds[depIdx];
        if (!isNaN(depIdx) && depId) {
          depends_on.push(depId);
        }
      }
    }

    return { taskInput, taskId, slot, depends_on };
  });

  const created = prepared.map((p) => ({
    ...p,
    task: tasksRepo.create({
      id: p.taskId,
      goal_id: goal.id,
      title: p.taskInput.title,
      estimate_minutes: p.taskInput.estimate_minutes,
      depends_on: p.depends_on,
      scheduled_start: p.slot?.start || undefined,
      scheduled_end: p.slot?.end || undefined,
      status: p.slot && p.slot.start ? 'scheduled' : 'todo',
    }),
  }));

  const newTasks: Task[] = await Promise.all(
    created.map(async ({ taskInput, taskId, slot, task }) => {
      if (!isGoogleConnected || !slot || !slot.start || !slot.end) {
        return task;
      }
      try {
        const calendarEventId = await calendarSync.createEvent({
          taskId,
          title: taskInput.title,
          start: new Date(slot.start),
          end: new Date(slot.end),
        });
        return tasksRepo.update(taskId, { calendar_event_id: calendarEventId });
      } catch (err) {
        console.error(`Failed to sync calendar event for task ${taskInput.title}:`, err);
        return task;
      }
    }),
  );

  // Emit eventBus events
  eventBus.emit('goal.created', goal);
  for (const t of newTasks) {
    if (t.scheduled_start) {
      eventBus.emit('task.scheduled', t);
    }
  }
  eventBus.emit('calendar.synced');

  return { goal, tasks: newTasks };
}

export function startEventForwarding(broadcast: (channel: string, payload?: unknown) => void): void {
  eventBus.on('goal.created', (goal: Goal) => {
    broadcast('goal:created', goal);
    broadcast('app-event', { type: 'goal.created', payload: { goalId: goal.id } });
  });

  eventBus.on('goal.updated', (goal: Goal) => {
    broadcast('goal:updated', goal);
    broadcast('app-event', { type: 'goal.updated', payload: { goalId: goal.id } });
  });

  eventBus.on('task.scheduled', (task: Task) => {
    broadcast('task:scheduled', task);
    broadcast('app-event', {
      type: 'task.scheduled',
      payload: {
        taskId: task.id,
        start: task.scheduled_start ?? '',
        end: task.scheduled_end ?? '',
      },
    });
  });

  eventBus.on('task.completed', (task: Task) => {
    broadcast('task:completed', task);
    broadcast('app-event', { type: 'task.completed', payload: { taskId: task.id } });
  });

  eventBus.on('calendar.synced', () => {
    broadcast('calendar:synced');
    broadcast('app-event', { type: 'calendar.synced', payload: { syncedCount: 0 } });
  });

  eventBus.on('summary.created', (summary: SummaryRow) => {
    broadcast('summary:created', summary);
    broadcast('app-event', { type: 'summary.created', payload: summary });
  });
}
