import { randomUUID } from 'node:crypto';
import Database from 'better-sqlite3';
import { Goal } from '@shared/types.js';

export class GoalsRepo {
  private db: Database.Database;
  private createStmt: Database.Statement;
  private getStmt: Database.Statement;
  private updateStmt: Database.Statement;

  constructor(db: Database.Database) {
    this.db = db;
    this.createStmt = this.db.prepare(`
      INSERT INTO goals (id, title, description, deadline, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    this.getStmt = this.db.prepare(`
      SELECT id, title, description, deadline, status, created_at, updated_at
      FROM goals
      WHERE id = ?
    `);
    this.updateStmt = this.db.prepare(`
      UPDATE goals
      SET title = ?, description = ?, deadline = ?, status = ?, updated_at = ?
      WHERE id = ?
    `);
  }

  create(input: Omit<Goal, 'id' | 'created_at' | 'updated_at'>): Goal {
    const id = randomUUID();
    const now = new Date().toISOString();
    const goal: Goal = {
      id,
      title: input.title,
      description: input.description,
      deadline: input.deadline,
      status: input.status,
      created_at: now,
      updated_at: now,
    };

    this.createStmt.run(
      goal.id,
      goal.title,
      goal.description ?? null,
      goal.deadline ?? null,
      goal.status,
      goal.created_at,
      goal.updated_at,
    );

    return goal;
  }

  get(id: string): Goal | null {
    const row = this.getStmt.get(id) as
      | {
          id: string;
          title: string;
          description: string | null;
          deadline: string | null;
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
      title: row.title,
      description: row.description ?? undefined,
      deadline: row.deadline ?? undefined,
      status: row.status as Goal['status'],
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  list(filter?: { status?: Goal['status'] }): Goal[] {
    let query =
      'SELECT id, title, description, deadline, status, created_at, updated_at FROM goals';
    const params: string[] = [];
    if (filter?.status) {
      query += ' WHERE status = ?';
      params.push(filter.status);
    }
    const stmt = this.db.prepare(query);
    const rows = stmt.all(...params) as {
      id: string;
      title: string;
      description: string | null;
      deadline: string | null;
      status: string;
      created_at: string;
      updated_at: string;
    }[];

    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      description: row.description ?? undefined,
      deadline: row.deadline ?? undefined,
      status: row.status as Goal['status'],
      created_at: row.created_at,
      updated_at: row.updated_at,
    }));
  }

  update(id: string, patch: Partial<Goal>): Goal {
    const existing = this.get(id);
    if (!existing) {
      throw new Error(`Goal with id ${id} not found`);
    }

    const now = new Date().toISOString();
    const updated: Goal = {
      ...existing,
      ...patch,
      id, // ensure ID is not overwritten
      created_at: existing.created_at, // ensure created_at is preserved
      updated_at: now,
    };

    this.updateStmt.run(
      updated.title,
      updated.description ?? null,
      updated.deadline ?? null,
      updated.status,
      updated.updated_at,
      id,
    );

    return updated;
  }

  delete(id: string): void {
    const stmt = this.db.prepare('DELETE FROM goals WHERE id = ?');
    stmt.run(id);
  }
}
