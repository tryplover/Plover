import type { GitCommitInfo } from '@shared/events.js';

export interface MatchCommitResponse {
  matchedTaskId: string | null;
  reasoning?: string;
}

export type CommitMatcher = (
  commit: GitCommitInfo,
  tasks: { id: string; title: string }[],
) => Promise<MatchCommitResponse>;
