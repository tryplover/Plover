import { CalendarEvent } from '../../shared/types';

interface SchedulableTask {
  id?: string;
  title: string;
  estimate_minutes: number;
  depends_on?: string[];
}

export function scheduleTasksLocal(
  tasks: SchedulableTask[],
  calendarEvents: CalendarEvent[],
  workingHours: { start: string; end: string },
  horizonDays: number,
): { taskId: string; start: string; end: string }[] {
  const [startHour, startMin] = (workingHours.start || '09:00').split(':').map(Number) as [
    number,
    number,
  ];
  const [endHour, endMin] = (workingHours.end || '18:00').split(':').map(Number) as [
    number,
    number,
  ];

  const scheduledSlots: { taskId: string; start: string; end: string }[] = [];
  const currentTime = new Date();

  const minutes = currentTime.getMinutes();
  const roundedMinutes = Math.ceil(minutes / 30) * 30;
  currentTime.setMinutes(roundedMinutes, 0, 0);

  const taskEndTimes = new Map<string, Date>();

  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i];
    if (!task) continue;
    const estimate = task.estimate_minutes || 60;
    const dependsOn = task.depends_on || [];

    let earliestStart = new Date(currentTime);
    for (const depId of dependsOn) {
      const depEndTime = taskEndTimes.get(depId);
      if (depEndTime && depEndTime > earliestStart) {
        earliestStart = new Date(depEndTime.getTime());
      }
    }

    let scheduled = false;
    const attemptTime = new Date(earliestStart);

    for (let day = 0; day < horizonDays; day++) {
      if (scheduled) break;

      const dayStart = new Date(attemptTime);
      dayStart.setHours(startHour, startMin, 0, 0);

      const dayEnd = new Date(attemptTime);
      dayEnd.setHours(endHour, endMin, 0, 0);

      if (attemptTime < dayStart) {
        attemptTime.setTime(dayStart.getTime());
      }

      const attemptEnd = new Date(attemptTime.getTime() + estimate * 60000);
      if (attemptEnd > dayEnd) {
        attemptTime.setDate(attemptTime.getDate() + 1);
        attemptTime.setHours(startHour, startMin, 0, 0);
        continue;
      }

      let overlaps = false;

      for (const event of calendarEvents) {
        const eventStart = new Date(event.start);
        const eventEnd = new Date(event.end);
        if (attemptTime < eventEnd && attemptEnd > eventStart) {
          overlaps = true;
          attemptTime.setTime(eventEnd.getTime());
          break;
        }
      }

      if (overlaps) {
        continue;
      }

      for (const slot of scheduledSlots) {
        const slotStart = new Date(slot.start);
        const slotEnd = new Date(slot.end);
        if (attemptTime < slotEnd && attemptEnd > slotStart) {
          overlaps = true;
          attemptTime.setTime(slotEnd.getTime());
          break;
        }
      }

      if (overlaps) {
        continue;
      }

      const taskId = task.id || `temp-task-${i}`;
      scheduledSlots.push({
        taskId,
        start: attemptTime.toISOString(),
        end: attemptEnd.toISOString(),
      });
      taskEndTimes.set(taskId, attemptEnd);
      scheduled = true;

      currentTime.setTime(attemptEnd.getTime());
    }
  }

  return scheduledSlots;
}
