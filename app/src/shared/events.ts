import { Goal, Task } from './types.js';

export interface EventPayloads {
  'goal.created': Goal;
  'goal.updated': Goal;
  'task.scheduled': Task;
  'task.completed': Task;
  'calendar.synced': undefined;
}

export type AppEvent =
  | { type: 'goal.created'; payload: { goalId: string } }
  | { type: 'goal.updated'; payload: { goalId: string } }
  | { type: 'task.scheduled'; payload: { taskId: string; start: string; end: string } }
  | { type: 'task.completed'; payload: { taskId: string } }
  | { type: 'calendar.synced'; payload: { syncedCount: number } };

export interface AppEventMap {
  'goal.created': { goalId: string };
  'goal.updated': { goalId: string };
  'task.scheduled': { taskId: string; start: string; end: string };
  'task.completed': { taskId: string };
  'calendar.synced': { syncedCount: number };
}
