import { useEffect, useState } from 'react';
import type { Task } from '../../shared/types';

export type StateKind = 'observing' | 'paused' | 'done' | 'not-sure';

export interface CompanionView {
  kind: StateKind;
  task: Task | null;
  progress: number;
  steps: { id: string; label: string; done: boolean; current: boolean }[];
  watching: { app: string; doc: string; lastLookAgoSec: number } | null;
}

export function useCompanionState(): CompanionView {
  const [view, setView] = useState<CompanionView>({
    kind: 'observing',
    task: null,
    progress: 0.65,
    steps: [],
    watching: null,
  });

  useEffect(() => {
    const offTask = window.api.on('companion:activeTask', async (taskId: unknown) => {
      const id = taskId as string | null;
      if (!id) return setView((v) => ({ ...v, task: null, steps: [] }));
      const tasks = await window.api.getTasks();
      const task = tasks.find((t) => t.id === id) ?? null;
      setView((v) => ({ ...v, task, steps: buildSteps(task, tasks) }));
    });
    const offState = window.api.on('companion:state', (kind: unknown) => {
      setView((v) => ({ ...v, kind: kind as StateKind }));
    });
    return () => { offTask(); offState(); };
  }, []);

  return view;
}

function buildSteps(task: Task | null, all: Task[]): CompanionView['steps'] {
  if (!task) return [];
  const siblings = all
    .filter((t) => t.goal_id === task.goal_id)
    .sort((a, b) => {
      const aStart = a.scheduled_start || '';
      const bStart = b.scheduled_start || '';
      if (aStart !== bStart) return aStart.localeCompare(bStart);
      return a.id.localeCompare(b.id);
    });
  const currentIdx = siblings.findIndex((t) => t.id === task.id);
  return siblings.map((t, i) => ({
    id: t.id,
    label: t.title,
    done: t.status === 'done',
    current: i === currentIdx,
  }));
}
