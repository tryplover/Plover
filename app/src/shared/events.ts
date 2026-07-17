import { Goal, Task, SummaryRow } from './types.js';

export interface FolderEventPayload {
  path: string;
  kind: 'md' | 'git_commit_editmsg' | 'other';
}

export interface GDocsRevisionPayload {
  fileId: string;
  name: string;
  modifiedTime: string;
}

export interface EventPayloads {
  'goal.created': Goal;
  'goal.updated': Goal;
  'goal.deleted': string;
  'task.scheduled': Task;
  'task.completed': Task;
  'calendar.synced': undefined;
  'folder.file_changed': FolderEventPayload;
  'folder.file_added': FolderEventPayload;
  'gdocs.revision': GDocsRevisionPayload;
  'summary.created': SummaryRow;
}

export type AppEvent =
  | { type: 'goal.created'; payload: { goalId: string } }
  | { type: 'goal.updated'; payload: { goalId: string } }
  | { type: 'goal.deleted'; payload: { goalId: string } }
  | { type: 'task.scheduled'; payload: { taskId: string; start: string; end: string } }
  | { type: 'task.completed'; payload: { taskId: string } }
  | { type: 'calendar.synced'; payload: { syncedCount: number } }
  | { type: 'summary.created'; payload: SummaryRow };

export interface AppEventMap {
  'goal.created': { goalId: string };
  'goal.updated': { goalId: string };
  'goal.deleted': { goalId: string };
  'task.scheduled': { taskId: string; start: string; end: string };
  'task.completed': { taskId: string };
  'calendar.synced': { syncedCount: number };
  'summary.created': SummaryRow;
}
