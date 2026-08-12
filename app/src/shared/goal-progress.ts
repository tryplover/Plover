import { Task } from './types';

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
