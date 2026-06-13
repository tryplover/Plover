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

  constructor(db: Database.Database) {
    this.db = db;
  }

  insert(row: { taskId: string | null; summary: string; signal: number; ts?: string }): SummaryRow {
    const ts = row.ts || new Date().toISOString();
    const stmt = this.db.prepare(`
      INSERT INTO summaries (task_id, ts, summary, signal)
      VALUES (?, ?, ?, ?)
    `);

    const result = stmt.run(row.taskId, ts, row.summary, row.signal);

    return {
      id: result.lastInsertRowid as number,
      task_id: row.taskId,
      ts,
      summary: row.summary,
      signal: row.signal,
    };
  }

  listForTask(taskId: string): SummaryRow[] {
    const stmt = this.db.prepare(`
      SELECT id, task_id, ts, summary, signal
      FROM summaries
      WHERE task_id = ?
      ORDER BY ts ASC
    `);

    const rows = stmt.all(taskId) as {
      id: number;
      task_id: string | null;
      ts: string;
      summary: string;
      signal: number;
    }[];

    return rows;
  }
}
