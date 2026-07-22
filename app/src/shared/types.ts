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
  status: 'todo' | 'scheduled' | 'in_progress' | 'done' | 'skipped';
  sort_index: number;
  created_at: string;
  updated_at: string;
}

export interface SummaryRow {
  id: number;
  task_id: string | null;
  ts: string;
  summary: string;
  signal: number;
}

export interface Session {
  id: string;
  task_id: string | null;
  started_at: string | null; // ISO8601 string
  ended_at: string | null; // ISO8601 string
}
