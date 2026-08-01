import { ipcMain } from 'electron';
import { Task } from '../../shared/types.js';
import { tasksRepo } from '../store/index.js';
import { scheduleTasks } from '../planner/schedule.js';
import { eventBus } from '../events/bus.js';

export function registerTasksHandlers(): void {
  ipcMain.handle('tasks:get', async () => {
    return tasksRepo.list();
  });

  ipcMain.handle('tasks:getById', async (_, id: string) => {
    return tasksRepo.get(id);
  });

  ipcMain.handle('tasks:getByGoal', async (_, goalId: string) => {
    return tasksRepo.listByGoal(goalId);
  });

  ipcMain.handle('tasks:updateStatus', async (_, id: string, status: Task['status']) => {
    const task = tasksRepo.update(id, { status });
    eventBus.emit('task.updated', { task });
    if (status === 'done') {
      eventBus.emit('task.completed', task);
    }
    return task;
  });

  ipcMain.handle(
    'tasks:create',
    async (_, input: { goal_id: string; title: string; estimate_minutes: number }) => {
      const task = tasksRepo.create({
        goal_id: input.goal_id,
        title: input.title,
        estimate_minutes: input.estimate_minutes,
        status: 'todo',
      });
      eventBus.emit('task.created', { task });
      return task;
    },
  );

  ipcMain.handle(
    'tasks:update',
    async (_, id: string, patch: { title?: string; estimate_minutes?: number }) => {
      const task = tasksRepo.update(id, patch);
      eventBus.emit('task.updated', { task });
      return task;
    },
  );

  ipcMain.handle('tasks:delete', async (_, id: string) => {
    tasksRepo.delete(id);
    return { ok: true as const };
  });

  ipcMain.handle('tasks:reorder', async (_, goal_id: string, orderedIds: string[]) => {
    tasksRepo.reorder(goal_id, orderedIds);
    return { ok: true as const };
  });

  ipcMain.handle(
    'tasks:schedule',
    async (
      _,
      tasksInput: Omit<
        Task,
        | 'id'
        | 'goal_id'
        | 'status'
        | 'created_at'
        | 'updated_at'
        | 'scheduled_start'
        | 'scheduled_end'
      >[],
      workingHours: { start: string; end: string },
      horizonDays: number,
    ) => {
      const mockTasks: Task[] = tasksInput.map((t, idx) => ({
        id: `temp-${idx}`,
        goal_id: 'temp-goal',
        title: t.title,
        estimate_minutes: t.estimate_minutes,
        depends_on: t.depends_on,
        status: 'todo',
        sort_index: idx,
        progress: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }));

      const slots = await scheduleTasks({
        tasks: mockTasks,
        workingHours,
        horizonDays,
      });

      return slots.map((s) => ({
        taskId: s.taskId,
        start: s.start.toISOString(),
        end: s.end.toISOString(),
      }));
    },
  );
}
