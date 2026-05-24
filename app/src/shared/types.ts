export interface Goal {
  id: string;
  title: string;
  description?: string;
  deadline?: string; // ISO8601 string
  status: 'active' | 'paused' | 'done' | 'dropped';
  created_at: string;
  updated_at: string;
}

export interface Task {
  id: string;
  goal_id: string;
  title: string;
  estimate_minutes: number;
  depends_on?: string[]; // Array of task IDs
  scheduled_start?: string; // ISO8601 string
  scheduled_end?: string; // ISO8601 string
  calendar_event_id?: string;
  status: 'todo' | 'scheduled' | 'in_progress' | 'done' | 'skipped';
  created_at: string;
  updated_at: string;
}

export interface CalendarEvent {
  id: string;
  summary: string;
  start: string; // ISO8601 string
  end: string; // ISO8601 string
}
