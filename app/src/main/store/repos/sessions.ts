import { randomUUID } from 'node:crypto';
import Database from 'better-sqlite3';
import { Session } from '@shared/types.js';

/**
 * SessionsRepo handles persistence for task sessions.
 * Optimization: SQL statements are pre-prepared in the constructor to reduce parsing/compilation
 * overhead during runtime. This typically improves database operation speed by 2x-5x for
 * simple queries in SQLite.
 */
export class SessionsRepo {
  private db: Database.Database;
  private createStmt: Database.Statement;
  private getStmt: Database.Statement;
  private listStmt: Database.Statement;
  private updateStmt: Database.Statement;
  private deleteStmt: Database.Statement;

  constructor(db: Database.Database) {
    this.db = db;
    // Pre-prepare statements to optimize execution performance
    this.createStmt = this.db.prepare(`
      INSERT INTO sessions (id, task_id, started_at, ended_at)
      VALUES (?, ?, ?, ?)
    `);
    this.getStmt = this.db.prepare(`
      SELECT id, task_id, started_at, ended_at
      FROM sessions
      WHERE id = ?
    `);
    this.listStmt = this.db.prepare(`
      SELECT id, task_id, started_at, ended_at
      FROM sessions
    `);
    this.updateStmt = this.db.prepare(`
      UPDATE sessions
      SET task_id = ?, started_at = ?, ended_at = ?
      WHERE id = ?
    `);
    this.deleteStmt = this.db.prepare('DELETE FROM sessions WHERE id = ?');
  }

  create(input: Omit<Session, 'id'>): Session {
    const id = randomUUID();
    const session: Session = {
      id,
      task_id: input.task_id,
      started_at: input.started_at,
      ended_at: input.ended_at,
    };

    this.createStmt.run(session.id, session.task_id, session.started_at, session.ended_at);

    return session;
  }

  get(id: string): Session | null {
    const row = this.getStmt.get(id) as Session | undefined;
    return row ?? null;
  }

  list(): Session[] {
    return this.listStmt.all() as Session[];
  }

  update(id: string, patch: Partial<Omit<Session, 'id'>>): Session {
    const existing = this.get(id);
    if (!existing) {
      throw new Error(`Session with id ${id} not found`);
    }

    const updated: Session = {
      id,
      task_id: patch.task_id !== undefined ? patch.task_id : existing.task_id,
      started_at: patch.started_at !== undefined ? patch.started_at : existing.started_at,
      ended_at: patch.ended_at !== undefined ? patch.ended_at : existing.ended_at,
    };

    this.updateStmt.run(updated.task_id, updated.started_at, updated.ended_at, id);

    return updated;
  }

  delete(id: string): void {
    this.deleteStmt.run(id);
  }
}
