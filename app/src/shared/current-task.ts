import { Task } from './types';

export function sortByPlanOrder(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => a.sort_index - b.sort_index || a.id.localeCompare(b.id));
}

// "Main task at hand" = the task Plover should be watching right now: not
// done/skipped, ranked in_progress > scheduled > todo, tie-broken the same
// way sortByPlanOrder orders a goal's own steps (plan order, by
// sort_index). There's no real activity monitoring yet (Phase 2+), so
// `in_progress` is rarely set by anything today — this mostly resolves to
// "first unfinished plan step" in practice.
export const TASK_STATUS_RANK: Record<Task['status'], number> = {
  in_progress: 0,
  scheduled: 1,
  todo: 2,
  done: 3,
  skipped: 3,
};

export function pickCurrentTask(tasks: Task[]): Task | null {
  const candidates = tasks.filter((t) => t.status !== 'done' && t.status !== 'skipped');
  const [first] = sortByPlanOrder(candidates).sort(
    (a, b) => TASK_STATUS_RANK[a.status] - TASK_STATUS_RANK[b.status],
  );
  return first ?? null;
}
