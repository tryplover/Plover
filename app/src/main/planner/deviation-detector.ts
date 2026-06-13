import { Notification } from 'electron';
import { Task, CalendarEvent } from '@shared/types.js';
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
    private notify: (title: string, body: string) => void = defaultNotify,
    private clock: () => Date = () => new Date(),
  ) {}

  checkCompletedBlocks(): MissedBlock[] {
    const now = this.clock();
    const allTasks = this.tasksRepo.list();
    const missed: MissedBlock[] = [];

    for (const task of allTasks) {
      if (task.status === 'done' || task.status === 'skipped') continue;
      if (!task.scheduled_start || !task.scheduled_end) continue;
      const end = new Date(task.scheduled_end);
      if (Number.isNaN(end.getTime()) || end >= now) continue;

      const start = new Date(task.scheduled_start);
      if (Number.isNaN(start.getTime())) continue;

      const activity = this.activityRepo.listBetween(
        task.scheduled_start,
        task.scheduled_end,
      );
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

    const candidateTask: Task = {
      ...task,
      scheduled_start: undefined,
      scheduled_end: undefined,
      calendar_event_id: undefined,
      depends_on: [],
    };

    const placements = scheduleTasks({
      tasks: [candidateTask],
      calendarEvents: existingEvents,
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
    for (const block of missed) {
      try {
        await this.rescheduleTask(block.task);
      } catch (err) {
        console.error('[DeviationDetector] reschedule failed for task', block.task.id, err);
      }
    }
  }
}

function defaultNotify(title: string, body: string): void {
  try {
    new Notification({ title, body }).show();
  } catch (err) {
    console.error('[DeviationDetector] Notification failed:', err);
  }
}

function formatLocal(date: Date): string {
  return date.toLocaleString(undefined, {
    weekday: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
}
