import { useState, useEffect, useCallback, useMemo } from 'react';
import { Goal, Task } from '../../../shared/types';
import { useAppEvents } from '../../hooks/useAppEvents';

export function useGoalsAndTasks(onChanged?: () => void) {
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
      ]);
      setGoals(allGoals);
      setTasks(allTasks);
    } catch (err) {
      console.error('Failed to load goals & tasks:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchData();
  }, [fetchData]);

  useAppEvents(() => {
    void fetchData();
    onChanged?.();
  });

  return { goals, tasks, loading, tasksByGoal, fetchData, setGoals, setTasks };
}
