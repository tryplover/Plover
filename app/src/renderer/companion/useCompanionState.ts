import { useCallback, useEffect, useRef, useState } from 'react';
import type { Task } from '../../shared/types';
import { pickCurrentTask } from '../../shared/current-task';
import { goalProgress } from '../../shared/goal-progress';
import { useAppEvents } from '../hooks/useAppEvents';

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
    progress: 0,
    steps: [],
    watching: null,
  });
  const mounted = useRef(true);

  const refetchTask = useCallback(async () => {
    const tasks = await window.api.getTasks();
    if (!mounted.current) return;
    const task = pickCurrentTask(tasks);
    if (!task) {
      setView((v) => ({ ...v, task: null, steps: [], progress: 0 }));
      return;
    }
    const siblings = await window.api.getTasksByGoal(task.goal_id);
    if (!mounted.current) return;
    const steps = buildSteps(task, siblings);
    setView((v) => ({ ...v, task, steps, progress: goalProgress(siblings, task.id) }));
  }, []);

  useEffect(() => {
    mounted.current = true;

    window.api.companion
      .getInitialState()
      .then(({ kind }) => {
        if (!mounted.current) return;
        setView((v) => ({ ...v, kind: kind as StateKind }));
      })
      .catch(() => undefined);

    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refetchTask();

    const offState = window.api.on('companion:state', (kind: unknown) => {
      if (!mounted.current) return;
      setView((v) => ({ ...v, kind: kind as StateKind }));
    });
    return () => {
      mounted.current = false;
      offState();
    };
  }, [refetchTask]);

  useAppEvents(() => {
    void refetchTask();
  });

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
