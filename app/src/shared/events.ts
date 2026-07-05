import { Goal, Task, SummaryRow } from './types.js';

export interface FolderEventPayload {
  path: string;
  kind: 'md' | 'git_commit_editmsg' | 'other';
}

export interface EventPayloads {
  'goal.created': Goal;
  'goal.updated': Goal;
  'task.scheduled': Task;
  'task.completed': Task;
  'calendar.synced': undefined;
  'folder.file_changed': FolderEventPayload;
  'folder.file_added': FolderEventPayload;
  'summary.created': SummaryRow;
  'inference.error': { message: string };
}

export type AppEvent =
  | { type: 'goal.created'; goalId: string }
  | { type: 'goal.updated'; goalId: string }
  | { type: 'task.scheduled'; taskId: string; start: string; end: string }
  | { type: 'task.completed'; taskId: string }
  | { type: 'calendar.synced'; syncedCount: number }
  | ({ type: 'summary.created' } & SummaryRow);

export function isAppEvent(x: unknown): x is AppEvent {
  return (
    typeof x === 'object' &&
    x !== null &&
    'type' in x &&
    typeof (x as { type: unknown }).type === 'string'
  );
}
