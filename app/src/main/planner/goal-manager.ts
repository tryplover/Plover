import { randomUUID } from 'node:crypto';
import { Goal, Task, SummaryRow } from '../../shared/types.js';
import { goalsRepo, tasksRepo } from '../store/index.js';
import { eventBus } from '../bus.js';

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
    | 'sort_index'
  >[],
  scheduledSlots: { tempIndex: number; start: string; end: string }[],
) {
  const goal = goalsRepo.create({
    title: goalInput.title,
    description: goalInput.description || '',
    deadline: goalInput.deadline,
    status: 'active',
  });

  const taskIds: string[] = subtaskInputs.map(() => randomUUID());

  const prepared = subtaskInputs.map((taskInput, index) => {
    const taskId = taskIds[index] ?? randomUUID();
    const slot = scheduledSlots.find((s) => s.tempIndex === index);

    const depends_on: string[] = [];
    if (Array.isArray(taskInput.depends_on)) {
      for (const depStr of taskInput.depends_on) {
        const depIdx = parseInt(depStr, 10);
        if (isNaN(depIdx) || depIdx < 0 || depIdx >= index) {
          continue;
        }
        const depId = taskIds[depIdx];
        if (depId) {
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

  const newTasks: Task[] = created.map(({ task }) => task);

  // Emit eventBus events
  eventBus.emit('goal.created', goal);
  for (const t of newTasks) {
    if (t.scheduled_start) {
      eventBus.emit('task.scheduled', t);
    }
  }

  return { goal, tasks: newTasks };
}

export async function deleteGoalAndTasks(goalId: string): Promise<void> {
  tasksRepo.deleteByGoal(goalId);
  goalsRepo.delete(goalId);

  eventBus.emit('goal.deleted', goalId);
}

export function startEventForwarding(
  broadcast: (channel: string, payload?: unknown) => void,
): void {
  eventBus.on('goal.created', (goal: Goal) => {
    broadcast('app-event', { type: 'goal.created', payload: { goalId: goal.id } });
  });

  eventBus.on('goal.updated', (goal: Goal) => {
    broadcast('app-event', { type: 'goal.updated', payload: { goalId: goal.id } });
  });

  eventBus.on('goal.deleted', (goalId: string) => {
    broadcast('app-event', { type: 'goal.deleted', payload: { goalId } });
  });

  eventBus.on('task.scheduled', (task: Task) => {
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
    broadcast('app-event', { type: 'task.completed', payload: { taskId: task.id } });
  });

  eventBus.on('summary.created', (summary: SummaryRow) => {
    broadcast('app-event', { type: 'summary.created', payload: summary });
  });
}
