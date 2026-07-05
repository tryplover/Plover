import { Task, CalendarEvent } from '@shared/types.js';
import { notifier } from '../notifier.js';
import { TasksRepo } from '../store/repos/tasks.js';
import { ActivityRepo } from '../store/repos/activity.js';
import { SettingsRepo } from '../store/repos/settings.js';
import { scheduleTasks } from './schedule.js';

const RESCHEDULE_HORIZON_DAYS_FALLBACK = 14;

export interface CalendarPort {
  listEvents(rangeStart: Date, rangeEnd: Date): Promise<CalendarEvent[]>;
  createEvent(input: { taskId: string; title: string; start: Date; end: Date }): Promise<string>;
  deleteEvent(eventId: string): Promise<void>;
}

export interface MissedBlock {
  task: Task;
  reason: 'afk' | 'distraction';
  evidenceCount: number;
}

export class DeviationDetector {
  constructor(
    private tasksRepo: TasksRepo,
    private activityRepo: ActivityRepo,
    private settingsRepo: SettingsRepo,
    private calendar: CalendarPort,
    private notify: (title: string, body: string) => void = (t, b) => notifier.show(t, b),
    private clock: () => Date = () => new Date(),
  ) {}

  checkCompletedBlocks(): MissedBlock[] {
    const now = this.clock();
    const activePastTasks = this.tasksRepo.listActiveScheduledBefore(now);
    const missed: MissedBlock[] = [];

    for (const task of activePastTasks) {
      if (!task.scheduled_start || !task.scheduled_end) continue;

      const activity = this.activityRepo.listBetween(task.scheduled_start, task.scheduled_end);
      if (activity.length === 0) {
        missed.push({ task, reason: 'afk', evidenceCount: 0 });
      }
    }

    return missed;
  }

  async rescheduleTask(task: Task): Promise<{ start: Date; end: Date; eventId: string } | null> {
    const settings = this.settingsRepo.getAll();
    const now = this.clock();
    const horizonDays = settings.horizonDays || RESCHEDULE_HORIZON_DAYS_FALLBACK;
    const rangeEnd = new Date(now.getTime() + horizonDays * 24 * 60 * 60 * 1000);

    if (task.calendar_event_id) {
      try {
        await this.calendar.deleteEvent(task.calendar_event_id);
      } catch (err) {
        console.error('[DeviationDetector] Failed to delete stale calendar event', err);
      }
    }

    let existingEvents: CalendarEvent[] = [];
    try {
      existingEvents = await this.calendar.listEvents(now, rangeEnd);
    } catch (err) {
      console.error('[DeviationDetector] Failed to list calendar events', err);
      return null;
    }

    const allTasks = this.tasksRepo.list();
    const activeTasks = allTasks.filter((t) => t.status !== 'done' && t.status !== 'skipped');
    const ploverEventIds = new Set(activeTasks.map((t) => t.calendar_event_id).filter(Boolean));
    const externalEvents = existingEvents.filter((e) => !ploverEventIds.has(e.id));

    const candidateTasks = activeTasks.map((t) => {
      if (t.id === task.id) {
        return {
          ...t,
          scheduled_start: undefined,
          scheduled_end: undefined,
          calendar_event_id: undefined,
        };
      }
      return t;
    });

    const placements = scheduleTasks({
      tasks: candidateTasks,
      calendarEvents: externalEvents,
      workingHours: settings.workingHours,
      horizonDays,
      now,
    });

    const placement = placements.find((p) => p.taskId === task.id);
    if (!placement) {
      console.warn('[DeviationDetector] No free slot found for task', task.id);
      return null;
    }

    let newEventId: string;
    try {
      newEventId = await this.calendar.createEvent({
        taskId: task.id,
        title: task.title,
        start: placement.start,
        end: placement.end,
      });
    } catch (err) {
      console.error('[DeviationDetector] Failed to create replacement calendar event', err);
      return null;
    }

    this.tasksRepo.update(task.id, {
      scheduled_start: placement.start.toISOString(),
      scheduled_end: placement.end.toISOString(),
      calendar_event_id: newEventId,
    });

    this.notify(
      'Plover',
      `Slid "${task.title}" to ${formatLocal(placement.start)} since you were away.`,
    );

    return { start: placement.start, end: placement.end, eventId: newEventId };
  }

  async runDeviationPass(): Promise<void> {
    const missed = this.checkCompletedBlocks();
    if (missed.length === 0) return;

    const missedTasks = missed.map((m) => m.task);
    const settings = this.settingsRepo.getAll();
    const now = this.clock();
    const horizonDays = settings.horizonDays || RESCHEDULE_HORIZON_DAYS_FALLBACK;
    const rangeEnd = new Date(now.getTime() + horizonDays * 24 * 60 * 60 * 1000);

    let existingEvents: CalendarEvent[] = [];
    try {
      existingEvents = await this.calendar.listEvents(now, rangeEnd);
    } catch (err) {
      console.error('[DeviationDetector] Failed to list calendar events', err);
      return;
    }

    const allTasks = this.tasksRepo.list();
    const activeTasks = allTasks.filter((t) => t.status !== 'done' && t.status !== 'skipped');

    const ploverEventIds = new Set(activeTasks.map((t) => t.calendar_event_id).filter(Boolean));
    const externalEvents = existingEvents.filter((e) => !ploverEventIds.has(e.id));

    const missedTaskIds = new Set(missedTasks.map((t) => t.id));
    const candidateTasks = activeTasks.map((t) => {
      if (missedTaskIds.has(t.id)) {
        return {
          ...t,
          scheduled_start: undefined,
          scheduled_end: undefined,
          calendar_event_id: undefined,
        };
      }
      return t;
    });

    const placements = scheduleTasks({
      tasks: candidateTasks,
      calendarEvents: externalEvents,
      workingHours: settings.workingHours,
      horizonDays,
      now,
    });

    const placementMap = new Map<string, { taskId: string; start: Date; end: Date }>();
    for (const p of placements) {
      placementMap.set(p.taskId, p);
    }

    for (const task of activeTasks) {
      const p = placementMap.get(task.id);
      if (!p) continue;

      const isMissed = missedTaskIds.has(task.id);
      const startChanged =
        !task.scheduled_start || new Date(task.scheduled_start).getTime() !== p.start.getTime();
      const endChanged =
        !task.scheduled_end || new Date(task.scheduled_end).getTime() !== p.end.getTime();
      const changed = startChanged || endChanged;

      if (isMissed || changed) {
        if (task.calendar_event_id) {
          try {
            await this.calendar.deleteEvent(task.calendar_event_id);
          } catch (err) {
            console.error('[DeviationDetector] Failed to delete stale calendar event', err);
          }
        }

        let newEventId: string;
        try {
          newEventId = await this.calendar.createEvent({
            taskId: task.id,
            title: task.title,
            start: p.start,
            end: p.end,
          });
        } catch (err) {
          console.error('[DeviationDetector] Failed to create replacement calendar event', err);
          continue;
        }

        this.tasksRepo.update(task.id, {
          scheduled_start: p.start.toISOString(),
          scheduled_end: p.end.toISOString(),
          calendar_event_id: newEventId,
        });

        this.notify(
          'Plover',
          `Slid "${task.title}" to ${formatLocal(p.start)} since you were away.`,
        );
      }
    }
  }
}

function formatLocal(date: Date): string {
  return date.toLocaleString(undefined, {
    weekday: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
}
