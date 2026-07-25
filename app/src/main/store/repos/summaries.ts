import Database from 'better-sqlite3';
import { SummaryRow } from '../../../shared/types.js';

export class SummariesRepo {
  private db: Database.Database;
  private insertStmt: Database.Statement;
  private listForTaskStmt: Database.Statement;
  private listAllStmt: Database.Statement;

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
    this.listAllStmt = this.db.prepare(`
      SELECT s.id, s.task_id, s.ts, s.summary, s.signal, t.title as task_title, g.title as goal_title
      FROM summaries s
      LEFT JOIN tasks t ON s.task_id = t.id
      LEFT JOIN goals g ON t.goal_id = g.id
      ORDER BY s.ts DESC
    `);
  }

  insert(row: {
    taskId: string | null;
    summary: string;
    signal: number;
    source?: 'inference' | 'commit_match';
    progressDelta?: number | null;
    previousStatus?: string | null;
    ts?: string;
  }): SummaryRow {
    const ts = row.ts || new Date().toISOString();
    const source = row.source ?? 'inference';
    const progressDelta = row.progressDelta ?? null;
    const previousStatus = row.previousStatus ?? null;
    const result = this.insertStmt.run(row.taskId, ts, row.summary, row.signal);

    return {
      id: result.lastInsertRowid as number,
      task_id: row.taskId,
      ts,
      summary: row.summary,
      signal: row.signal,
      source,
      progress_delta: progressDelta,
      previous_status: previousStatus,
      corrected: 0,
    };
  }

  listForTask(taskId: string): SummaryRow[] {
    return this.listForTaskStmt.all(taskId) as SummaryRow[];
  }

  listAll(): (SummaryRow & { task_title: string | null; goal_title: string | null })[] {
    return this.listAllStmt.all() as (SummaryRow & {
      task_title: string | null;
      goal_title: string | null;
    })[];
  }
}
