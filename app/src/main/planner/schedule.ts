import { Task } from '@shared/types';

function parseHHMM(value: string, field: string): { hours: number; minutes: number } {
  const parts = value.split(':');
  if (parts.length !== 2) {
    throw new Error(`Invalid ${field} time format: ${value} (expected HH:MM)`);
  }
  const hours = Number(parts[0]);
  const minutes = Number(parts[1]);
  if (
    !Number.isInteger(hours) ||
    !Number.isInteger(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    throw new Error(`Invalid ${field} time: ${value} (HH must be 0-23, MM must be 0-59)`);
  }
  return { hours, minutes };
}

export function scheduleTasks(input: {
  tasks: Task[];
  workingHours: { start: string; end: string };
  horizonDays: number;
  now?: Date;
}): { taskId: string; start: Date; end: Date }[] {
  const now = input.now ?? new Date();
  const { tasks, workingHours, horizonDays } = input;

  const sorted: Task[] = [];
  const visited = new Set<string>();
  const tempVisited = new Set<string>();

  const taskMap = new Map<string, Task>();
  for (const t of tasks) {
    taskMap.set(t.id, t);
  }

  function visit(taskId: string) {
    if (tempVisited.has(taskId)) {
      throw new Error(`Cycle detected in task dependencies: ${taskId}`);
    }
    if (!visited.has(taskId)) {
      tempVisited.add(taskId);
      const task = taskMap.get(taskId);
      if (task) {
        const deps = task.depends_on || [];
        for (const depId of deps) {
          if (taskMap.has(depId)) {
            visit(depId);
          }
        }
        sorted.push(task);
      }
      tempVisited.delete(taskId);
      visited.add(taskId);
    }
  }

  for (const t of tasks) {
    if (!visited.has(t.id)) {
      visit(t.id);
    }
  }

  const scheduledTasks = new Map<string, { startMs: number; endMs: number }>();
  const { hours: startHours, minutes: startMinutes } = parseHHMM(
    workingHours.start,
    'workingHours.start',
  );
  const { hours: endHours, minutes: endMinutes } = parseHHMM(workingHours.end, 'workingHours.end');

  // Pre-calculate day boundaries as primitive milliseconds to avoid nested Date instantiations.
  const daysData = Array.from({ length: horizonDays }, (_, i) => {
    const currentDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
    const dayStart = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth(),
      currentDate.getDate(),
      startHours,
      startMinutes,
      0,
      0,
    ).getTime();
    const dayEnd = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth(),
      currentDate.getDate(),
      endHours,
      endMinutes,
      0,
      0,
    ).getTime();
    return { dayStart, dayEnd };
  });

  const horizonEnd = daysData[horizonDays - 1]?.dayEnd ?? 0;

  for (const T of sorted) {
    const E = T.estimate_minutes;
    const durationMs = E * 60 * 1000;

    let minStartTime = now.getTime();
    let hasUnscheduledDep = false;

    for (const depId of T.depends_on || []) {
      if (taskMap.has(depId)) {
        const scheduledDep = scheduledTasks.get(depId);
        if (!scheduledDep) {
          hasUnscheduledDep = true;
          break;
        }
        if (scheduledDep.endMs > minStartTime) {
          minStartTime = scheduledDep.endMs;
        }
      }
    }

    if (hasUnscheduledDep) {
      continue;
    }

    let scheduled = false;

    dayLoop: for (let i = 0; i < horizonDays; i++) {
      const dayData = daysData[i];
      if (!dayData) {
        continue;
      }
      const { dayStart, dayEnd } = dayData;

      const workStart = Math.max(minStartTime, dayStart);
      const workEnd = dayEnd;

      if (workStart >= workEnd) {
        continue;
      }

      // Pre-filter scheduled tasks that overlap with the current day's work window
      // to avoid checking the entire set of scheduled tasks in the inner loop.
      const todaysScheduledTasks: { startMs: number; endMs: number }[] = [];
      for (const scheduledTask of scheduledTasks.values()) {
        if (scheduledTask.startMs < workEnd && scheduledTask.endMs > workStart) {
          todaysScheduledTasks.push(scheduledTask);
        }
      }

      let S = workStart;
      while (S < workEnd) {
        const end = S + durationMs;

        if (end > horizonEnd) {
          break dayLoop;
        }

        const dailyWindowSize = dayEnd - dayStart;
        if (durationMs <= dailyWindowSize) {
          if (end > dayEnd) {
            break;
          }
        }

        let overlapEvent: { startMs: number; endMs: number } | null = null;

        for (const scheduledTask of todaysScheduledTasks) {
          const taskStart = scheduledTask.startMs;
          const taskEnd = scheduledTask.endMs;
          if (S < taskEnd && end > taskStart) {
            if (!overlapEvent || taskEnd > overlapEvent.endMs) {
              overlapEvent = { startMs: taskStart, endMs: taskEnd };
            }
          }
        }

        if (overlapEvent) {
          S = overlapEvent.endMs;
          continue;
        }

        scheduledTasks.set(T.id, { startMs: S, endMs: end });
        scheduled = true;
        break;
      }

      if (scheduled) {
        break;
      }
    }
  }

  const result: { taskId: string; start: Date; end: Date }[] = [];
  for (const t of tasks) {
    const scheduled = scheduledTasks.get(t.id);
    if (scheduled) {
      result.push({
        taskId: t.id,
        start: new Date(scheduled.startMs),
        end: new Date(scheduled.endMs),
      });
    }
  }

  return result;
}
