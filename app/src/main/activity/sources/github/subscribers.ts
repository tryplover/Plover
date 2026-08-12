import { SubscriberSpec } from '../activity-subscriber.js';

export const GITHUB_SUBSCRIBER_SPECS: readonly SubscriberSpec[] = [
  { event: 'github.commit', gate: 'githubTrackingEnabled', kind: 'github_commit' },
  { event: 'github.pr', gate: 'githubTrackingEnabled', kind: 'github_pr' },
  { event: 'github.review', gate: 'githubTrackingEnabled', kind: 'github_review' },
];
