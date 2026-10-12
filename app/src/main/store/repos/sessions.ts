import { randomUUID } from 'node:crypto';
import Database from 'better-sqlite3';
import { Session } from '@shared/types.js';

export type SessionInput = Pick<Session, 'task_id' | 'started_at' | 'ended_at'> &
  Partial<Pick<Session, 'phase' | 'planned_seconds'>>;

const COLUMNS = 'id, task_id, started_at, ended_at, phase, planned_seconds';

export class SessionsRepo {
  private db: Database.Database;
  private createStmt: Database.Statement;
  private getStmt: Database.Statement;
  private listStmt: Database.Statement;
  private updateStmt: Database.Statement;
  private deleteStmt: Database.Statement;

  constructor(db: Database.Database) {
    this.db = db;
    this.createStmt = this.db.prepare(`
      INSERT INTO sessions (${COLUMNS})
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    this.getStmt = this.db.prepare(`SELECT ${COLUMNS} FROM sessions WHERE id = ?`);
    this.listStmt = this.db.prepare(`SELECT ${COLUMNS} FROM sessions`);
    this.updateStmt = this.db.prepare(`
      UPDATE sessions
      SET task_id = ?, started_at = ?, ended_at = ?, phase = ?, planned_seconds = ?
      WHERE id = ?
    `);
    this.deleteStmt = this.db.prepare('DELETE FROM sessions WHERE id = ?');
  }

  create(input: SessionInput): Session {
    const session: Session = {
      id: randomUUID(),
      task_id: input.task_id,
      started_at: input.started_at,
      ended_at: input.ended_at,
      phase: input.phase ?? 'work',
      planned_seconds: input.planned_seconds ?? null,
    };

    this.createStmt.run(
      session.id,
      session.task_id,
      session.started_at,
      session.ended_at,
      session.phase,
      session.planned_seconds,
    );

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
      phase: patch.phase ?? existing.phase,
      planned_seconds:
        patch.planned_seconds !== undefined ? patch.planned_seconds : existing.planned_seconds,
    };

    this.updateStmt.run(
      updated.task_id,
      updated.started_at,
      updated.ended_at,
      updated.phase,
      updated.planned_seconds,
      id,
    );

    return updated;
  }

  delete(id: string): void {
    this.deleteStmt.run(id);
  }
}
