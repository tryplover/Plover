import { ipcMain } from 'electron';
import { Task } from '@shared/types.js';
import { tasksRepo } from '../store/index.js';
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
}
