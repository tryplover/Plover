import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { TypedEventBus } from '@main/events/bus.js';
import { SettingsData } from '@main/store/repos/settings.js';
import { ContextSource } from '../source-poller.js';

function dueDateToISO(d?: { year?: number | null; month?: number | null; day?: number | null } | null): string | null {
  if (!d?.year || !d.month || !d.day) return null;
  const mm = String(d.month).padStart(2, '0');
  const dd = String(d.day).padStart(2, '0');
  return `${d.year}-${mm}-${dd}`;
}

export class ClassroomSource implements ContextSource {
  readonly provider = 'google';
  readonly source = 'classroom';

  constructor(private auth: { client: OAuth2Client }, private eventBus: TypedEventBus) {}

  enabled(settings: SettingsData): boolean {
    return settings.googleConnected && settings.classroomEnabled;
  }

  async poll(cursor: string | null): Promise<string> {
    const now = new Date().toISOString();
    if (cursor === null) return now;

    const classroom = google.classroom({ version: 'v1', auth: this.auth.client });
    const coursesRes = await classroom.courses.list({ courseStates: ['ACTIVE'] });
    const cursorMs = Date.parse(cursor);
    let maxSeen = cursorMs;

    for (const course of coursesRes.data.courses ?? []) {
      if (!course.id) continue;
      const workRes = await classroom.courses.courseWork.list({ courseId: course.id });
      for (const w of workRes.data.courseWork ?? []) {
        const updated = w.updateTime ? Date.parse(w.updateTime) : NaN;
        if (!Number.isFinite(updated) || updated <= cursorMs || !w.id) continue;
        if (updated > maxSeen) maxSeen = updated;
        this.eventBus.emit('classroom.coursework', {
          courseId: course.id,
          courseName: course.name ?? '',
          id: w.id,
          title: w.title ?? '(untitled)',
          dueDate: dueDateToISO(w.dueDate),
          state: w.state ?? 'PUBLISHED',
        });
      }
    }

    return Number.isFinite(maxSeen) && maxSeen > cursorMs ? new Date(maxSeen).toISOString() : now;
  }
}
