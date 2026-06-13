import Database from 'better-sqlite3';

export interface ActivityRow {
  id: number;
  ts: string;
  kind: string;
  payload: Record<string, unknown>;
}

interface ActivityDbRow {
  id: number;
  ts: string;
  kind: string;
  payload: string;
}

export class ActivityRepo {
  private db: Database.Database;
  private insertStmt: Database.Statement;
  private listSinceStmt: Database.Statement;
  private listBetweenStmt: Database.Statement;

  constructor(db: Database.Database) {
    this.db = db;
    this.insertStmt = this.db.prepare(`
      INSERT INTO activity (ts, kind, payload)
      VALUES (?, ?, ?)
    `);
    this.listSinceStmt = this.db.prepare(`
      SELECT id, ts, kind, payload
      FROM activity
      WHERE ts >= ?
      ORDER BY ts ASC
    `);
    this.listBetweenStmt = this.db.prepare(`
      SELECT id, ts, kind, payload
      FROM activity
      WHERE ts >= ? AND ts <= ?
      ORDER BY ts ASC
    `);
  }

  insert(row: { kind: string; payload: Record<string, unknown>; ts?: string }): ActivityRow {
    const ts = row.ts || new Date().toISOString();
    const result = this.insertStmt.run(ts, row.kind, JSON.stringify(row.payload));

    return {
      id: result.lastInsertRowid as number,
      ts,
      kind: row.kind,
      payload: row.payload,
    };
  }

  listSince(ts: string): ActivityRow[] {
    const rows = this.listSinceStmt.all(ts) as ActivityDbRow[];
    return rows.map((row) => ({
      id: row.id,
      ts: row.ts,
      kind: row.kind,
      payload: JSON.parse(row.payload) as Record<string, unknown>,
    }));
  }

  listBetween(start: string, end: string): ActivityRow[] {
    const rows = this.listBetweenStmt.all(start, end) as ActivityDbRow[];
    return rows.map((row) => ({
      id: row.id,
      ts: row.ts,
      kind: row.kind,
      payload: JSON.parse(row.payload) as Record<string, unknown>,
    }));
  }
}
