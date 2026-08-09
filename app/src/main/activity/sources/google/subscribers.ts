import { SubscriberSpec } from '../activity-subscriber.js';

export const GOOGLE_SUBSCRIBER_SPECS: readonly SubscriberSpec[] = [
  { event: 'gmail.message', gate: 'gmailEnabled', kind: 'gmail_message' },
  { event: 'calendar.event', gate: 'calendarEnabled', kind: 'calendar_event' },
  { event: 'classroom.coursework', gate: 'classroomEnabled', kind: 'classroom_coursework' },
  { event: 'gdocs.revision', gate: 'gdocsPollingEnabled', kind: 'gdocs_revision' },
];
