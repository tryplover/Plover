export interface ActivityKindInfo {
  kind: string;
  label: string;
  phase: 1 | 2;
}

export const ACTIVITY_KINDS: ActivityKindInfo[] = [
  // Phase 1
  { kind: 'window_focus', label: 'Window Focus', phase: 1 },
  { kind: 'gdocs_revision', label: 'Google Docs Revision', phase: 1 },
  { kind: 'file_modified', label: 'File Modified', phase: 1 },
  { kind: 'file_added', label: 'File Added', phase: 1 },
  { kind: 'git_commit', label: 'Git Commit', phase: 1 },
  { kind: 'screenshot_captured', label: 'Screenshot Captured', phase: 1 },
  { kind: 'screenshot_inferred', label: 'Screenshot Inferred', phase: 1 },

  // Phase 2
  { kind: 'github_pr_opened', label: 'GitHub PR Opened', phase: 2 },
  { kind: 'github_pr_merged', label: 'GitHub PR Merged', phase: 2 },
  { kind: 'github_issue_assigned', label: 'GitHub Issue Assigned', phase: 2 },
  { kind: 'github_review_requested', label: 'GitHub Review Requested', phase: 2 },
  { kind: 'notion_page_edited', label: 'Notion Page Edited', phase: 2 },
  { kind: 'notion_db_row_added', label: 'Notion DB Row Added', phase: 2 },
  { kind: 'file_indexed', label: 'File Indexed', phase: 2 },
];
