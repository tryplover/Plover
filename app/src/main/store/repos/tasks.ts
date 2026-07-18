import { randomUUID } from 'node:crypto';
import Database from 'better-sqlite3';
import { Task } from '@shared/types.js';

export class TasksRepo {
  private db: Database.Database;
  private createStmt: Database.Statement;
  private getStmt: Database.Statement;
  private listByGoalStmt: Database.Statement;
  private updateStmt: Database.Statement;
  private listStmt: Database.Statement;
  private listActiveScheduledBeforeStmt: Database.Statement;
  private deleteByGoalStmt: Database.Statement;

  constructor(db: Database.Database) {
    this.db = db;
    this.createStmt = this.db.prepare(`
      INSERT INTO tasks (
        id, goal_id, title, estimate_minutes, depends_on,
        scheduled_start, scheduled_end, status,
        sort_index, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    this.getStmt = this.db.prepare(`
      SELECT id, goal_id, title, estimate_minutes, depends_on,
             scheduled_start, scheduled_end, status,
             sort_index, created_at, updated_at
      FROM tasks
      WHERE id = ?
    `);
    this.listByGoalStmt = this.db.prepare(`
      SELECT id, goal_id, title, estimate_minutes, depends_on,
             scheduled_start, scheduled_end, status,
             sort_index, created_at, updated_at
      FROM tasks
      WHERE goal_id = ?
      ORDER BY sort_index, created_at
    `);
    this.updateStmt = this.db.prepare(`
      UPDATE tasks
      SET goal_id = ?, title = ?, estimate_minutes = ?, depends_on = ?,
          scheduled_start = ?, scheduled_end = ?, status = ?,
          updated_at = ?
      WHERE id = ?
    `);
    this.listStmt = this.db.prepare(`
      SELECT id, goal_id, title, estimate_minutes, depends_on,
             scheduled_start, scheduled_end, status,
             sort_index, created_at, updated_at
      FROM tasks
    `);
    this.listActiveScheduledBeforeStmt = this.db.prepare(`
      SELECT id, goal_id, title, estimate_minutes, depends_on,
             scheduled_start, scheduled_end, status,
             sort_index, created_at, updated_at
      FROM tasks
      WHERE status NOT IN ('done', 'skipped')
        AND scheduled_start IS NOT NULL
        AND scheduled_end IS NOT NULL
        AND scheduled_end < ?
    `);
    this.deleteByGoalStmt = this.db.prepare(`
      DELETE FROM tasks
      WHERE goal_id = ?
    `);
  }

  create(
    input: Omit<Task, 'id' | 'created_at' | 'updated_at' | 'sort_index'> & {
      id?: string;
      sort_index?: number;
    },
  ): Task {
    const id = input.id || randomUUID();
    const now = new Date().toISOString();

    const maxRow = this.db
      .prepare(`SELECT COALESCE(MAX(sort_index) + 1, 0) AS next FROM tasks WHERE goal_id = ?`)
      .get(input.goal_id) as { next: number };
    const sortIndex = input.sort_index ?? maxRow.next;

    const task: Task = {
      id,
      goal_id: input.goal_id,
      title: input.title,
      estimate_minutes: input.estimate_minutes,
      depends_on: input.depends_on,
      scheduled_start: input.scheduled_start,
      scheduled_end: input.scheduled_end,
      status: input.status,
      sort_index: sortIndex,
      created_at: now,
      updated_at: now,
    };

    this.createStmt.run(
      task.id,
      task.goal_id,
      task.title,
      task.estimate_minutes,
      task.depends_on ? JSON.stringify(task.depends_on) : null,
      task.scheduled_start ?? null,
      task.scheduled_end ?? null,
      task.status,
      task.sort_index,
      task.created_at,
      task.updated_at,
    );

    return task;
  }

  get(id: string): Task | null {
    const row = this.getStmt.get(id) as
      | {
          id: string;
          goal_id: string;
          title: string;
          estimate_minutes: number;
          depends_on: string | null;
          scheduled_start: string | null;
          scheduled_end: string | null;
          status: string;
          sort_index: number;
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
      status: row.status as Task['status'],
      sort_index: row.sort_index,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  listByGoal(goalId: string): Task[] {
    const rows = this.listByGoalStmt.all(goalId) as {
      id: string;
      goal_id: string;
      title: string;
      estimate_minutes: number;
      depends_on: string | null;
      scheduled_start: string | null;
      scheduled_end: string | null;
      status: string;
      sort_index: number;
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
      status: row.status as Task['status'],
      sort_index: row.sort_index,
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

    this.updateStmt.run(
      updated.goal_id,
      updated.title,
      updated.estimate_minutes,
      updated.depends_on ? JSON.stringify(updated.depends_on) : null,
      updated.scheduled_start ?? null,
      updated.scheduled_end ?? null,
      updated.status,
      updated.updated_at,
      id,
    );

    return updated;
  }

  list(): Task[] {
    const rows = this.listStmt.all() as {
      id: string;
      goal_id: string;
      title: string;
      estimate_minutes: number;
      depends_on: string | null;
      scheduled_start: string | null;
      scheduled_end: string | null;
      status: string;
      sort_index: number;
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
      status: row.status as Task['status'],
      sort_index: row.sort_index,
      created_at: row.created_at,
      updated_at: row.updated_at,
    }));
  }

  listActiveScheduledBefore(now: Date): Task[] {
    const rows = this.listActiveScheduledBeforeStmt.all(now.toISOString()) as {
      id: string;
      goal_id: string;
      title: string;
      estimate_minutes: number;
      depends_on: string | null;
      scheduled_start: string | null;
      scheduled_end: string | null;
      status: string;
      sort_index: number;
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
      status: row.status as Task['status'],
      sort_index: row.sort_index,
      created_at: row.created_at,
      updated_at: row.updated_at,
    }));
  }

  deleteByGoal(goalId: string): void {
    this.deleteByGoalStmt.run(goalId);
  }
}
