import { Goal, Task } from './types.js';

export interface EventPayloads {
  'goal.created': Goal;
  'goal.updated': Goal;
  'task.scheduled': Task;
  'task.completed': Task;
  'calendar.synced': undefined;
}
