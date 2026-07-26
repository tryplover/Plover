import { Task } from './types';

export function sortByScheduledStart(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => {
    const aStart = a.scheduled_start;
    const bStart = b.scheduled_start;
    if (!aStart && !bStart) return a.id.localeCompare(b.id);
    if (!aStart) return 1;
    if (!bStart) return -1;
    if (aStart !== bStart) return aStart.localeCompare(bStart);
    return a.id.localeCompare(b.id);
  });
}

// "Main task at hand" = the task Plover should be watching right now: not
// done/skipped, ranked in_progress > scheduled > todo, tie-broken the same
// way sortByScheduledStart orders a goal's own steps. There's no real activity
// monitoring yet (Phase 2+), so `in_progress` is rarely set by anything
// today — this mostly resolves to "earliest scheduled/todo task" in
// practice, which is still a real, non-fabricated signal.
export const TASK_STATUS_RANK: Record<Task['status'], number> = {
  in_progress: 0,
  scheduled: 1,
  todo: 2,
  done: 3,
  skipped: 3,
};

export function pickCurrentTask(tasks: Task[]): Task | null {
  const candidates = tasks.filter((t) => t.status !== 'done' && t.status !== 'skipped');
  const [first] = sortByScheduledStart(candidates).sort(
    (a, b) => TASK_STATUS_RANK[a.status] - TASK_STATUS_RANK[b.status],
  );
  return first ?? null;
}
