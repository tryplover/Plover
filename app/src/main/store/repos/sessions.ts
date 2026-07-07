import { randomUUID } from 'node:crypto';
import Database from 'better-sqlite3';
import { Session } from '@shared/types.js';

export class SessionsRepo {
  private db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
  }

  create(input: Omit<Session, 'id'>): Session {
    const id = randomUUID();
    const session: Session = {
      id,
      task_id: input.task_id,
      started_at: input.started_at,
      ended_at: input.ended_at,
    };

    const stmt = this.db.prepare(`
      INSERT INTO sessions (id, task_id, started_at, ended_at)
      VALUES (?, ?, ?, ?)
    `);

    stmt.run(session.id, session.task_id, session.started_at, session.ended_at);

    return session;
  }

  get(id: string): Session | null {
    const stmt = this.db.prepare(`
      SELECT id, task_id, started_at, ended_at
      FROM sessions
      WHERE id = ?
    `);

    const row = stmt.get(id) as Session | undefined;
    return row ?? null;
  }

  list(): Session[] {
    const stmt = this.db.prepare(`
      SELECT id, task_id, started_at, ended_at
      FROM sessions
    `);

    return stmt.all() as Session[];
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

    const stmt = this.db.prepare(`
      UPDATE sessions
      SET task_id = ?, started_at = ?, ended_at = ?
      WHERE id = ?
    `);

    stmt.run(updated.task_id, updated.started_at, updated.ended_at, id);

    return updated;
  }

  delete(id: string): void {
    const stmt = this.db.prepare('DELETE FROM sessions WHERE id = ?');
    stmt.run(id);
  }
}
