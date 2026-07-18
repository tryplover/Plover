import { Task, CalendarEvent } from '@shared/types';

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
  calendarEvents: CalendarEvent[];
  workingHours: { start: string; end: string };
  horizonDays: number;
  now?: Date;
}): { taskId: string; start: Date; end: Date }[] {
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

  const scheduledTasks = new Map<string, { start: Date; end: Date; startMs: number; endMs: number }>();
  const { hours: startHours, minutes: startMinutes } = parseHHMM(
    workingHours.start,
    'workingHours.start',
  );
  const { hours: endHours, minutes: endMinutes } = parseHHMM(workingHours.end, 'workingHours.end');

  const parsedCalendarEvents = calendarEvents
    .map((event) => ({
      start: new Date(event.start).getTime(),
      end: new Date(event.end).getTime(),
    }))
    .filter((event) => !Number.isNaN(event.start) && !Number.isNaN(event.end));

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

  // Pre-calculate static day parameters and pre-filter static calendar events once per day upfront
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
    const dayStartTime = dayStart.getTime();
    const dayEndTime = dayEnd.getTime();
    const dailyWindowSize = dayEndTime - dayStartTime;

    const dailyCalendarEvents = parsedCalendarEvents.filter(
      (event) => event.start < dayEndTime && event.end > dayStartTime,
    );

    return {
      dayStartTime,
      dayEndTime,
      dailyWindowSize,
      dailyCalendarEvents,
    };
  });

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
      const {
        dayStartTime,
        dayEndTime,
        dailyWindowSize,
        dailyCalendarEvents,
      } = dayData;

      const workStart = Math.max(minStartTime, dayStartTime);
      const workEnd = dayEndTime;

      if (workStart >= workEnd) {
        continue;
      }

      // Filter already scheduled tasks to only include those that overlap with this day
      // Uses fast primitive numbers to avoid Date creation or object property lookup costs
      const dailyScheduledTasks: { start: number; end: number }[] = [];
      for (const scheduledTask of scheduledTasks.values()) {
        if (scheduledTask.startMs < dayEndTime && scheduledTask.endMs > dayStartTime) {
          dailyScheduledTasks.push({ start: scheduledTask.startMs, end: scheduledTask.endMs });
        }
      }

      let S = workStart;
      while (S < workEnd) {
        const end = S + durationMs;

        if (end > horizonEnd) {
          break dayLoop;
        }

        if (durationMs <= dailyWindowSize) {
          if (end > dayEndTime) {
            break;
          }
        }

        let overlapEvent: { start: number; end: number } | null = null;

        // Use pre-filtered daily events to avoid scanning irrelevant global calendar events
        for (const event of dailyCalendarEvents) {
          if (S < event.end && end > event.start) {
            if (!overlapEvent || event.end > overlapEvent.end) {
              overlapEvent = { start: event.start, end: event.end };
            }
          }
        }

        // Use pre-filtered daily scheduled tasks to avoid scanning irrelevant global scheduled tasks
        for (const task of dailyScheduledTasks) {
          if (S < task.end && end > task.start) {
            if (!overlapEvent || task.end > overlapEvent.end) {
              overlapEvent = { start: task.start, end: task.end };
            }
          }
        }

        if (overlapEvent) {
          S = overlapEvent.end;
          continue;
        }

        scheduledTasks.set(T.id, {
          start: new Date(S),
          end: new Date(end),
          startMs: S,
          endMs: end,
        });
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
