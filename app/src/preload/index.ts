import { contextBridge, ipcRenderer } from 'electron';
import { Task, Goal } from '../shared/types';

contextBridge.exposeInMainWorld('api', {
  getGoals: () => ipcRenderer.invoke('goals:get'),
  getTasks: () => ipcRenderer.invoke('tasks:get'),
  updateTaskStatus: (id: string, status: Task['status']) =>
    ipcRenderer.invoke('tasks:updateStatus', id, status),
  decomposeGoal: (goalText: string) => ipcRenderer.invoke('goals:decompose', goalText),
  scheduleTasks: (
    tasks: Omit<
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
    calendarEvents: { id: string; summary: string; start: string; end: string }[],
    workingHours: { start: string; end: string },
    horizonDays: number,
  ) => ipcRenderer.invoke('tasks:schedule', tasks, calendarEvents, workingHours, horizonDays),
  saveGoalAndTasks: (
    goal: Omit<Goal, 'id' | 'created_at' | 'updated_at' | 'status'>,
    tasks: Omit<
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
  ) => ipcRenderer.invoke('goals:save', goal, tasks, scheduledSlots),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  updateSettings: (
    settings: Partial<{
      googleConnected: boolean;
      workingHours: { start: string; end: string };
      horizonDays: number;
      pauseScheduling: boolean;
    }>,
  ) => ipcRenderer.invoke('settings:update', settings),
  connectCalendar: () => ipcRenderer.invoke('calendar:connect'),
  disconnectCalendar: () => ipcRenderer.invoke('calendar:disconnect'),
  on: (channel: string, callback: (...args: unknown[]) => void) => {
    const subscription = (_event: unknown, ...args: unknown[]) => callback(...args);
    ipcRenderer.on(channel, subscription);
    return () => {
      ipcRenderer.removeListener(channel, subscription);
    };
  },
});
