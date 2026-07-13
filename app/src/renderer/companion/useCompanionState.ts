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
    let active = true;

    window.api.companion
      .getInitialState()
      .then(async ({ kind, activeTaskId }) => {
        if (!active) return;
        if (activeTaskId) {
          const task = await window.api.getTaskById(activeTaskId);
          if (!active) return;
          const siblings = task ? await window.api.getTasksByGoal(task.goal_id) : [];
          if (!active) return;
          setView((v) => ({
            ...v,
            kind: kind as StateKind,
            task,
            steps: buildSteps(task, siblings),
          }));
        } else {
          setView((v) => ({ ...v, kind: kind as StateKind }));
        }
      })
      .catch(() => undefined);

    const offTask = window.api.on('companion:activeTask', async (taskId: unknown) => {
      if (!active) return;
      const id = taskId as string | null;
      if (!id) return setView((v) => ({ ...v, task: null, steps: [] }));
      const task = await window.api.getTaskById(id);
      if (!active) return;
      const siblings = task ? await window.api.getTasksByGoal(task.goal_id) : [];
      if (!active) return;
      setView((v) => ({ ...v, task, steps: buildSteps(task, siblings) }));
    });
    const offState = window.api.on('companion:state', (kind: unknown) => {
      if (!active) return;
      setView((v) => ({ ...v, kind: kind as StateKind }));
    });
    return () => {
      active = false;
      offTask();
      offState();
    };
  }, []);

  return view;
}

function buildSteps(task: Task | null, all: Task[]): CompanionView['steps'] {
  if (!task) return [];
  const siblings = all
    .filter((t) => t.goal_id === task.goal_id)
    .sort((a, b) => {
      const aStart = a.scheduled_start;
      const bStart = b.scheduled_start;
      if (!aStart && !bStart) return a.id.localeCompare(b.id);
      if (!aStart) return 1;
      if (!bStart) return -1;
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
