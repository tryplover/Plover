import { Task, CalendarEvent } from '@shared/types';

export async function scheduleTasks(input: {
  tasks: Task[];
  calendarEvents: CalendarEvent[];
  workingHours: { start: string; end: string };
  horizonDays: number;
  now?: Date;
}): Promise<{ taskId: string; start: Date; end: Date }[]> {
  const now = input.now ?? new Date();
  const { tasks, calendarEvents, workingHours, horizonDays } = input;

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

  const scheduledTasks = new Map<string, { start: Date; end: Date }>();
  const [startHoursStr, startMinutesStr] = workingHours.start.split(':');
  const [endHoursStr, endMinutesStr] = workingHours.end.split(':');
  const startHours = Number(startHoursStr);
  const startMinutes = Number(startMinutesStr);
  const endHours = Number(endHoursStr);
  const endMinutes = Number(endMinutesStr);

  const lastDayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + horizonDays - 1);
  const horizonEnd = new Date(
    lastDayDate.getFullYear(),
    lastDayDate.getMonth(),
    lastDayDate.getDate(),
    endHours,
    endMinutes,
    0,
    0,
  ).getTime();

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
        if (scheduledDep.end.getTime() > minStartTime) {
          minStartTime = scheduledDep.end.getTime();
        }
      }
    }

    if (hasUnscheduledDep) {
      continue;
    }

    let scheduled = false;

    dayLoop: for (let i = 0; i < horizonDays; i++) {
      const currentDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
      const dayStart = new Date(
        currentDate.getFullYear(),
        currentDate.getMonth(),
        currentDate.getDate(),
        startHours,
        startMinutes,
        0,
        0,
      );
      const dayEnd = new Date(
        currentDate.getFullYear(),
        currentDate.getMonth(),
        currentDate.getDate(),
        endHours,
        endMinutes,
        0,
        0,
      );

      const workStart = Math.max(minStartTime, dayStart.getTime());
      const workEnd = dayEnd.getTime();

      if (workStart >= workEnd) {
        continue;
      }

      let S = workStart;
      while (S < workEnd) {
        const end = S + durationMs;

        if (end > horizonEnd) {
          break dayLoop;
        }

        const dailyWindowSize = dayEnd.getTime() - dayStart.getTime();
        if (durationMs <= dailyWindowSize) {
          if (end > dayEnd.getTime()) {
            break;
          }
        }

        let overlapEvent: { start: number; end: number } | null = null;

        for (const event of calendarEvents) {
          const eventStart = new Date(event.start).getTime();
          const eventEnd = new Date(event.end).getTime();
          if (S < eventEnd && end > eventStart) {
            if (!overlapEvent || eventEnd > overlapEvent.end) {
              overlapEvent = { start: eventStart, end: eventEnd };
            }
          }
        }

        for (const scheduledTask of scheduledTasks.values()) {
          const taskStart = scheduledTask.start.getTime();
          const taskEnd = scheduledTask.end.getTime();
          if (S < taskEnd && end > taskStart) {
            if (!overlapEvent || taskEnd > overlapEvent.end) {
              overlapEvent = { start: taskStart, end: taskEnd };
            }
          }
        }

        if (overlapEvent) {
          S = overlapEvent.end;
          continue;
        }

        scheduledTasks.set(T.id, { start: new Date(S), end: new Date(end) });
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
        start: scheduled.start,
        end: scheduled.end,
      });
    }
  }

  return result;
}
