import { ipcMain, BrowserWindow } from 'electron';
import { FileStore } from './store/index';
import { mockDecomposeGoal } from './planner/decompose-mock';
import { scheduleTasksLocal } from './planner/schedule-mock';
import { Goal, Task, CalendarEvent } from '../shared/types';
import { AppEvent } from '../shared/events';

type SaveGoalTaskInput = Omit<
  Task,
  | 'id'
  | 'goal_id'
  | 'status'
  | 'created_at'
  | 'updated_at'
  | 'scheduled_start'
  | 'scheduled_end'
  | 'calendar_event_id'
>;

export function setupIpcHandlers(store: FileStore) {
  const notifyRenderer = (event: AppEvent) => {
    const windows = BrowserWindow.getAllWindows();
    for (const win of windows) {
      if (!win.isDestroyed()) {
        win.webContents.send('app-event', event);
      }
    }
  };

  // Goals
  ipcMain.handle('goals:get', () => {
    return store.getGoals();
  });

  // Tasks
  ipcMain.handle('tasks:get', () => {
    return store.getTasks();
  });

  ipcMain.handle('tasks:updateStatus', (_event, id: string, status: Task['status']) => {
    const updated = store.updateTaskStatus(id, status);
    if (status === 'done') {
      notifyRenderer({ type: 'task.completed', payload: { taskId: id } });
    }
    return updated;
  });

  // Planner
  ipcMain.handle('goals:decompose', (_event, goalText: string) => {
    return mockDecomposeGoal(goalText);
  });

  ipcMain.handle(
    'tasks:schedule',
    (
      _event,
      tasks: SaveGoalTaskInput[],
      calendarEvents: CalendarEvent[],
      workingHours: { start: string; end: string },
      horizonDays: number,
    ) => {
      return scheduleTasksLocal(tasks, calendarEvents, workingHours, horizonDays);
    },
  );

  ipcMain.handle(
    'goals:save',
    (
      _event,
      goalInput: Omit<Goal, 'id' | 'created_at' | 'updated_at' | 'status'>,
      subtaskInputs: SaveGoalTaskInput[],
      scheduledSlots: { tempIndex: number; start: string; end: string }[],
    ) => {
      const goalId = `goal-${Date.now()}`;
      const newGoal: Goal = {
        id: goalId,
        title: goalInput.title,
        description: goalInput.description || '',
        deadline: goalInput.deadline,
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const newTasks: Task[] = subtaskInputs.map((task: SaveGoalTaskInput, index: number) => {
        const slot = scheduledSlots.find((s) => s.tempIndex === index);
        const taskId = `task-${Date.now()}-${index}`;

        const depends_on: string[] = [];
        if (index > 0) {
          depends_on.push(`task-${Date.now()}-${index - 1}`);
        }

        return {
          id: taskId,
          goal_id: goalId,
          title: task.title,
          estimate_minutes: task.estimate_minutes,
          depends_on,
          scheduled_start: slot?.start || undefined,
          scheduled_end: slot?.end || undefined,
          status: slot && slot.start ? 'scheduled' : 'todo',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
      });

      store.addGoal(newGoal);
      store.addTasks(newTasks);

      notifyRenderer({ type: 'goal.created', payload: { goalId } });
      for (const task of newTasks) {
        if (task.scheduled_start && task.scheduled_end) {
          notifyRenderer({
            type: 'task.scheduled',
            payload: { taskId: task.id, start: task.scheduled_start, end: task.scheduled_end },
          });
        }
      }
      notifyRenderer({
        type: 'calendar.synced',
        payload: { syncedCount: newTasks.filter((t) => t.scheduled_start).length },
      });

      return { goal: newGoal, tasks: newTasks };
    },
  );

  // Settings
  ipcMain.handle('settings:get', () => {
    return store.getSettings();
  });

  ipcMain.handle(
    'settings:update',
    (
      _event,
      settings: Partial<{
        googleConnected: boolean;
        workingHours: { start: string; end: string };
        horizonDays: number;
        pauseScheduling: boolean;
      }>,
    ) => {
      store.updateSettings(settings);
    },
  );

  ipcMain.handle('calendar:connect', () => {
    store.updateSettings({ googleConnected: true });
    notifyRenderer({ type: 'calendar.synced', payload: { syncedCount: 0 } });
    return true;
  });

  ipcMain.handle('calendar:disconnect', () => {
    store.updateSettings({ googleConnected: false });
    return undefined;
  });
}
