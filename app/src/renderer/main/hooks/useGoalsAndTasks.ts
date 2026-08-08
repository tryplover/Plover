import { useState, useEffect, useCallback, useMemo } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { Goal, Task } from '../../../shared/types';
import { useAppEvents } from '../../hooks/useAppEvents';

interface UseGoalsAndTasksOptions {
  // Runs inside the same Promise.all as the goals/tasks fetch so a page can
  // load its own extra data without paying a second round-trip.
  loadExtra?: () => Promise<void>;
  onLoaded?: (goals: Goal[], tasks: Task[]) => void;
  onAppEvent?: () => void;
}

export interface GoalsAndTasks {
  goals: Goal[];
  tasks: Task[];
  setTasks: Dispatch<SetStateAction<Task[]>>;
  tasksByGoal: Record<string, Task[]>;
  loading: boolean;
  fetchData: () => Promise<void>;
}

export function useGoalsAndTasks({
  loadExtra,
  onLoaded,
  onAppEvent,
}: UseGoalsAndTasksOptions = {}): GoalsAndTasks {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  const tasksByGoal = useMemo(() => {
    const map: Record<string, Task[]> = {};
    for (const task of tasks) {
      const list = map[task.goal_id];
      if (list) {
        list.push(task);
      } else {
        map[task.goal_id] = [task];
      }
    }
    return map;
  }, [tasks]);

  const fetchData = useCallback(async () => {
    try {
      const [allGoals, allTasks] = await Promise.all([
        window.api.getGoals(),
        window.api.getTasks(),
        loadExtra?.(),
      ]);
      setGoals(allGoals);
      setTasks(allTasks);
      onLoaded?.(allGoals, allTasks);
    } catch (err) {
      console.error('Failed to load goals & tasks:', err);
    } finally {
      setLoading(false);
    }
  }, [loadExtra, onLoaded]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchData();
  }, [fetchData]);

  useAppEvents(() => {
    void fetchData();
    onAppEvent?.();
  });

  return { goals, tasks, setTasks, tasksByGoal, loading, fetchData };
}
