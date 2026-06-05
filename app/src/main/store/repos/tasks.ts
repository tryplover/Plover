import { randomUUID } from 'node:crypto';
import Database from 'better-sqlite3';
import { Task } from '@shared/types.js';

export class TasksRepo {
  private db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
  }

  create(input: Omit<Task, 'id' | 'created_at' | 'updated_at'> & { id?: string }): Task {
    const id = input.id || randomUUID();
    const now = new Date().toISOString();
    const task: Task = {
      id,
      goal_id: input.goal_id,
      title: input.title,
      estimate_minutes: input.estimate_minutes,
      depends_on: input.depends_on,
      scheduled_start: input.scheduled_start,
      scheduled_end: input.scheduled_end,
      calendar_event_id: input.calendar_event_id,
      status: input.status,
      created_at: now,
      updated_at: now,
    };

    const stmt = this.db.prepare(`
      INSERT INTO tasks (
        id, goal_id, title, estimate_minutes, depends_on,
        scheduled_start, scheduled_end, calendar_event_id, status,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      task.id,
      task.goal_id,
      task.title,
      task.estimate_minutes,
      task.depends_on ? JSON.stringify(task.depends_on) : null,
      task.scheduled_start ?? null,
      task.scheduled_end ?? null,
      task.calendar_event_id ?? null,
      task.status,
      task.created_at,
      task.updated_at,
    );

    return task;
  }

  get(id: string): Task | null {
    const stmt = this.db.prepare(`
      SELECT id, goal_id, title, estimate_minutes, depends_on,
             scheduled_start, scheduled_end, calendar_event_id, status,
             created_at, updated_at
      FROM tasks
      WHERE id = ?
    `);

    const row = stmt.get(id) as
      | {
          id: string;
          goal_id: string;
          title: string;
          estimate_minutes: number;
          depends_on: string | null;
          scheduled_start: string | null;
          scheduled_end: string | null;
          calendar_event_id: string | null;
          status: string;
          created_at: string;
          updated_at: string;
        }
      | undefined;

    if (!row) {
      return null;
    }

    return {
      id: row.id,
      goal_id: row.goal_id,
      title: row.title,
      estimate_minutes: row.estimate_minutes,
      depends_on: row.depends_on ? (JSON.parse(row.depends_on) as string[]) : undefined,
      scheduled_start: row.scheduled_start ?? undefined,
      scheduled_end: row.scheduled_end ?? undefined,
      calendar_event_id: row.calendar_event_id ?? undefined,
      status: row.status as Task['status'],
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  listByGoal(goalId: string): Task[] {
    const stmt = this.db.prepare(`
      SELECT id, goal_id, title, estimate_minutes, depends_on,
             scheduled_start, scheduled_end, calendar_event_id, status,
             created_at, updated_at
      FROM tasks
      WHERE goal_id = ?
    `);

    const rows = stmt.all(goalId) as {
      id: string;
      goal_id: string;
      title: string;
      estimate_minutes: number;
      depends_on: string | null;
      scheduled_start: string | null;
      scheduled_end: string | null;
      calendar_event_id: string | null;
      status: string;
      created_at: string;
      updated_at: string;
    }[];

    return rows.map((row) => ({
      id: row.id,
      goal_id: row.goal_id,
      title: row.title,
      estimate_minutes: row.estimate_minutes,
      depends_on: row.depends_on ? (JSON.parse(row.depends_on) as string[]) : undefined,
      scheduled_start: row.scheduled_start ?? undefined,
      scheduled_end: row.scheduled_end ?? undefined,
      calendar_event_id: row.calendar_event_id ?? undefined,
      status: row.status as Task['status'],
      created_at: row.created_at,
      updated_at: row.updated_at,
    }));
  }

  listScheduledBetween(start: Date, end: Date): Task[] {
    const stmt = this.db.prepare(`
      SELECT id, goal_id, title, estimate_minutes, depends_on,
             scheduled_start, scheduled_end, calendar_event_id, status,
             created_at, updated_at
      FROM tasks
      WHERE scheduled_start IS NOT NULL
        AND (
          (scheduled_start >= ? AND scheduled_start <= ?)
          OR (scheduled_start < ? AND status NOT IN ('done', 'skipped'))
        )
    `);

    const rows = stmt.all(start.toISOString(), end.toISOString(), start.toISOString()) as {
      id: string;
      goal_id: string;
      title: string;
      estimate_minutes: number;
      depends_on: string | null;
      scheduled_start: string | null;
      scheduled_end: string | null;
      calendar_event_id: string | null;
      status: string;
      created_at: string;
      updated_at: string;
    }[];

    return rows.map((row) => ({
      id: row.id,
      goal_id: row.goal_id,
      title: row.title,
      estimate_minutes: row.estimate_minutes,
      depends_on: row.depends_on ? (JSON.parse(row.depends_on) as string[]) : undefined,
      scheduled_start: row.scheduled_start ?? undefined,
      scheduled_end: row.scheduled_end ?? undefined,
      calendar_event_id: row.calendar_event_id ?? undefined,
      status: row.status as Task['status'],
      created_at: row.created_at,
      updated_at: row.updated_at,
    }));
  }

  update(id: string, patch: Partial<Task>): Task {
    const existing = this.get(id);
    if (!existing) {
      throw new Error(`Task with id ${id} not found`);
    }

    const now = new Date().toISOString();
    const updated: Task = {
      ...existing,
      ...patch,
      id, // ensure ID is not overwritten
      created_at: existing.created_at, // ensure created_at is preserved
      updated_at: now,
    };

    const stmt = this.db.prepare(`
      UPDATE tasks
      SET goal_id = ?, title = ?, estimate_minutes = ?, depends_on = ?,
          scheduled_start = ?, scheduled_end = ?, calendar_event_id = ?, status = ?,
          updated_at = ?
      WHERE id = ?
    `);

    stmt.run(
      updated.goal_id,
      updated.title,
      updated.estimate_minutes,
      updated.depends_on ? JSON.stringify(updated.depends_on) : null,
      updated.scheduled_start ?? null,
      updated.scheduled_end ?? null,
      updated.calendar_event_id ?? null,
      updated.status,
      updated.updated_at,
      id,
    );

    return updated;
  }

  list(): Task[] {
    const stmt = this.db.prepare(`
      SELECT id, goal_id, title, estimate_minutes, depends_on,
             scheduled_start, scheduled_end, calendar_event_id, status,
             created_at, updated_at
      FROM tasks
    `);

    const rows = stmt.all() as {
      id: string;
      goal_id: string;
      title: string;
      estimate_minutes: number;
      depends_on: string | null;
      scheduled_start: string | null;
      scheduled_end: string | null;
      calendar_event_id: string | null;
      status: string;
      created_at: string;
      updated_at: string;
    }[];

    return rows.map((row) => ({
      id: row.id,
      goal_id: row.goal_id,
      title: row.title,
      estimate_minutes: row.estimate_minutes,
      depends_on: row.depends_on ? (JSON.parse(row.depends_on) as string[]) : undefined,
      scheduled_start: row.scheduled_start ?? undefined,
      scheduled_end: row.scheduled_end ?? undefined,
      calendar_event_id: row.calendar_event_id ?? undefined,
      status: row.status as Task['status'],
      created_at: row.created_at,
      updated_at: row.updated_at,
    }));
  }

}
