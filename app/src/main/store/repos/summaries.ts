import Database from 'better-sqlite3';

export interface SummaryRow {
  id: number;
  task_id: string | null;
  ts: string;
  summary: string;
  signal: number;
}

export class SummariesRepo {
  private db: Database.Database;
  private insertStmt: Database.Statement;
  private listForTaskStmt: Database.Statement;

  constructor(db: Database.Database) {
    this.db = db;
    this.insertStmt = this.db.prepare(`
      INSERT INTO summaries (task_id, ts, summary, signal)
      VALUES (?, ?, ?, ?)
    `);
    this.listForTaskStmt = this.db.prepare(`
      SELECT id, task_id, ts, summary, signal
      FROM summaries
      WHERE task_id = ?
      ORDER BY ts ASC
    `);
  }

  insert(row: { taskId: string | null; summary: string; signal: number; ts?: string }): SummaryRow {
    const ts = row.ts || new Date().toISOString();
    const result = this.insertStmt.run(row.taskId, ts, row.summary, row.signal);

    return {
      id: result.lastInsertRowid as number,
      task_id: row.taskId,
      ts,
      summary: row.summary,
      signal: row.signal,
    };
  }

  listForTask(taskId: string): SummaryRow[] {
    return this.listForTaskStmt.all(taskId) as SummaryRow[];
  }

  listAll(): (SummaryRow & { task_title: string | null; goal_title: string | null })[] {
    const stmt = this.db.prepare(`
      SELECT s.id, s.task_id, s.ts, s.summary, s.signal, t.title as task_title, g.title as goal_title
      FROM summaries s
      LEFT JOIN tasks t ON s.task_id = t.id
      LEFT JOIN goals g ON t.goal_id = g.id
      ORDER BY s.ts DESC
    `);
    return stmt.all() as (SummaryRow & { task_title: string | null; goal_title: string | null })[];
  }
}
