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
  // Persisted form: array of task IDs. Decomposition output uses stringified
  // 0-based indices into the subtasks array; the IPC commit step maps those
  // indices to the freshly-minted task IDs before insertion.
  depends_on?: string[];
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
