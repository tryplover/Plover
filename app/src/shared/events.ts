import { Goal, Task, SummaryRow } from './types.js';

export interface FolderEventPayload {
  path: string;
  kind: 'md' | 'git_commit_editmsg' | 'other';
}

export interface GDocsRevisionPayload {
  fileId: string;
  name: string;
  modifiedTime: string;
  revisionId?: string;
}

export interface GmailMessagePayload {
  id: string;
  threadId: string;
  from: string;
  subject: string;
  snippet: string;
  labels: string[];
  receivedAt: string;
}

export interface CalendarEventPayload {
  id: string;
  title: string;
  start: string;
  end: string;
  status: string;
  attendeeCount: number;
  location: string | null;
}

export interface ClassroomCourseworkPayload {
  courseId: string;
  courseName: string;
  id: string;
  title: string;
  dueDate: string | null;
  state: string;
}

export interface GitCommitInfo {
  repoPath: string;
  hash: string;
  message: string;
}

export interface GitHubCommitPayload {
  repo: string;
  sha: string;
  message: string;
  author: string;
  url: string;
  committedAt: string;
}

export interface GitHubPrPayload {
  repo: string;
  number: number;
  title: string;
  state: string;
  action: string;
  url: string;
  updatedAt: string;
}

export interface GitHubReviewPayload {
  repo: string;
  prNumber: number;
  kind: 'requested' | 'reviewed' | 'commented' | 'mentioned';
  url: string;
  updatedAt: string;
}

export interface EventPayloads {
  'goal.created': Goal;
  'goal.updated': Goal;
  'goal.deleted': string;
  'task.created': { task: Task };
  'task.updated': { task: Task };
  'task.scheduled': Task;
  'task.completed': Task;
  'task.deleted': { id: string };
  'tasks.reordered': { goal_id: string; orderedIds: string[] };
  'folder.file_changed': FolderEventPayload;
  'folder.file_added': FolderEventPayload;
  'gdocs.revision': GDocsRevisionPayload;
  'gmail.message': GmailMessagePayload;
  'calendar.event': CalendarEventPayload;
  'classroom.coursework': ClassroomCourseworkPayload;
  'summary.created': SummaryRow;
  'summary.corrected': SummaryRow;
  'activity.git_commit': GitCommitInfo;
  'github.commit': GitHubCommitPayload;
  'github.pr': GitHubPrPayload;
  'github.review': GitHubReviewPayload;
}
