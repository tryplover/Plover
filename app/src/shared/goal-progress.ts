import { Task } from './types';

// Goal completion as a 0–1 fraction: the steps that are finished, plus how far
// the current step has come. Finished steps are the certain part; the current
// step's own `progress` is an inference estimate, so it can only ever move the
// bar within its own single step's share and never completes one on its own.
export function goalProgress(tasks: Task[], currentTaskId: string | null): number {
  if (tasks.length === 0) return 0;

  const doneCount = tasks.filter((t) => t.status === 'done').length;
  const current = currentTaskId ? tasks.find((t) => t.id === currentTaskId) : undefined;
  const partial =
    current && current.status !== 'done' && current.status !== 'skipped'
      ? current.progress / 100
      : 0;

  return Math.min(1, (doneCount + partial) / tasks.length);
}
