import { randomUUID } from 'node:crypto';
import Database from 'better-sqlite3';
import { Session } from '@shared/types.js';

export class SessionsRepo {
  private db: Database.Database;
  private insertStmt: Database.Statement;
  private getStmt: Database.Statement;
  private listForTaskStmt: Database.Statement;
  private updateStmt: Database.Statement;
  private deleteStmt: Database.Statement;

  constructor(db: Database.Database) {
    this.db = db;
    this.insertStmt = db.prepare(`
      INSERT INTO sessions (id, task_id, started_at, ended_at)
      VALUES (?, ?, ?, ?)
    `);
    this.getStmt = db.prepare(`
      SELECT id, task_id, started_at, ended_at
      FROM sessions
      WHERE id = ?
    `);
    this.listForTaskStmt = db.prepare(`
      SELECT id, task_id, started_at, ended_at
      FROM sessions
      WHERE task_id = ?
      ORDER BY started_at ASC
    `);
    this.updateStmt = db.prepare(`
      UPDATE sessions
      SET task_id = ?, started_at = ?, ended_at = ?
      WHERE id = ?
    `);
    this.deleteStmt = db.prepare('DELETE FROM sessions WHERE id = ?');
  }

  create(input: Omit<Session, 'id'>): Session {
    const id = randomUUID();
    const session: Session = {
      id,
      task_id: input.task_id,
      started_at: input.started_at,
      ended_at: input.ended_at,
    };

    this.insertStmt.run(session.id, session.task_id, session.started_at, session.ended_at);

    return session;
  }

  get(id: string): Session | null {
    const row = this.getStmt.get(id) as Session | undefined;
    return row || null;
  }

  listForTask(taskId: string): Session[] {
    return this.listForTaskStmt.all(taskId) as Session[];
  }

  update(id: string, patch: Partial<Session>): Session {
    const existing = this.get(id);
    if (!existing) {
      throw new Error(`Session with id ${id} not found`);
    }

    const updated: Session = {
      ...existing,
      ...patch,
      id,
    };

    this.updateStmt.run(updated.task_id, updated.started_at, updated.ended_at, id);

    return updated;
  }

  delete(id: string): void {
    this.deleteStmt.run(id);
  }
}
