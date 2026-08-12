import Database from 'better-sqlite3';
import { SummaryRow } from '@shared/types.js';

export type { SummaryRow };

export class SummariesRepo {
  private db: Database.Database;
  private insertStmt: Database.Statement;
  private listForTaskStmt: Database.Statement;
  private listAllStmt: Database.Statement;
  private getStmt: Database.Statement;
  private markCorrectedStmt: Database.Statement;
  private reassignTaskStmt: Database.Statement;

  constructor(db: Database.Database) {
    this.db = db;
    this.insertStmt = this.db.prepare(`
      INSERT INTO summaries (task_id, ts, summary, signal, source, progress_delta, previous_status)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    this.listForTaskStmt = this.db.prepare(`
      SELECT id, task_id, ts, summary, signal, source, progress_delta, previous_status, corrected
      FROM summaries
      WHERE task_id = ?
      ORDER BY ts ASC
    `);
    this.listAllStmt = this.db.prepare(`
      SELECT s.id, s.task_id, s.ts, s.summary, s.signal, s.source, s.progress_delta,
             s.previous_status, s.corrected, t.title as task_title, g.title as goal_title
      FROM summaries s
      LEFT JOIN tasks t ON s.task_id = t.id
      LEFT JOIN goals g ON t.goal_id = g.id
      ORDER BY s.ts DESC
    `);
    this.getStmt = this.db.prepare(`
      SELECT id, task_id, ts, summary, signal, source, progress_delta, previous_status, corrected
      FROM summaries
      WHERE id = ?
    `);
    this.markCorrectedStmt = this.db.prepare(`
      UPDATE summaries SET corrected = 1 WHERE id = ?
    `);
    this.reassignTaskStmt = this.db.prepare(`
      UPDATE summaries SET task_id = ?, corrected = 1 WHERE id = ?
    `);
  }

  insert(row: {
    taskId: string | null;
    summary: string;
    signal: number;
    source: 'inference' | 'commit_match';
    progressDelta?: number | null;
    previousStatus?: string | null;
    ts?: string;
  }): SummaryRow {
    const ts = row.ts || new Date().toISOString();
    const progressDelta = row.progressDelta ?? null;
    const previousStatus = row.previousStatus ?? null;
    const result = this.insertStmt.run(
      row.taskId,
      ts,
      row.summary,
      row.signal,
      row.source,
      progressDelta,
      previousStatus,
    );

    return {
      id: result.lastInsertRowid as number,
      task_id: row.taskId,
      ts,
      summary: row.summary,
      signal: row.signal,
      source: row.source,
      progress_delta: progressDelta,
      previous_status: previousStatus,
      corrected: 0,
    };
  }

  get(id: number): SummaryRow | null {
    const row = this.getStmt.get(id) as SummaryRow | undefined;
    return row ?? null;
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

  markCorrected(id: number): void {
    const info = this.markCorrectedStmt.run(id);
    if (info.changes === 0) {
      throw new Error(`Summary with id ${id} not found`);
    }
  }

  reassignTask(id: number, newTaskId: string): void {
    const info = this.reassignTaskStmt.run(newTaskId, id);
    if (info.changes === 0) {
      throw new Error(`Summary with id ${id} not found`);
    }
  }
}
