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
  'folder.file_changed': FolderEventPayload;
  'folder.file_added': FolderEventPayload;
  'gdocs.revision': GDocsRevisionPayload;
  'summary.created': SummaryRow;
}

