import { randomUUID } from 'node:crypto';
import Database from 'better-sqlite3';

export interface ActivityRow {
  id: number;
  ts: string;
  kind: string;
  payload: Record<string, unknown>;
}

export class ActivityRepo {
  private db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
  }

  insert(row: { kind: string; payload: Record<string, unknown>; ts?: string }): ActivityRow {
    const ts = row.ts || new Date().toISOString();
    const stmt = this.db.prepare(`
      INSERT INTO activity (ts, kind, payload)
      VALUES (?, ?, ?)
    `);

    const result = stmt.run(ts, row.kind, JSON.stringify(row.payload));

    return {
      id: result.lastInsertRowid as number,
      ts,
      kind: row.kind,
      payload: row.payload,
    };
  }

  listSince(ts: string): ActivityRow[] {
    const stmt = this.db.prepare(`
      SELECT id, ts, kind, payload
      FROM activity
      WHERE ts >= ?
      ORDER BY ts ASC
    `);

    const rows = stmt.all(ts) as {
      id: number;
      ts: string;
      kind: string;
      payload: string;
    }[];

    return rows.map((row) => ({
      id: row.id,
      ts: row.ts,
      kind: row.kind,
      payload: JSON.parse(row.payload) as Record<string, unknown>,
    }));
  }

  listBetween(start: string, end: string): ActivityRow[] {
    const stmt = this.db.prepare(`
      SELECT id, ts, kind, payload
      FROM activity
      WHERE ts >= ? AND ts <= ?
      ORDER BY ts ASC
    `);

    const rows = stmt.all(start, end) as {
      id: number;
      ts: string;
      kind: string;
      payload: string;
    }[];

    return rows.map((row) => ({
      id: row.id,
      ts: row.ts,
      kind: row.kind,
      payload: JSON.parse(row.payload) as Record<string, unknown>,
    }));
  }
}
