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

  log(kind: string, payload: Record<string, unknown>, ts?: string): void {
    const stmt = this.db.prepare('INSERT INTO activity (ts, kind, payload) VALUES (?, ?, ?)');
    stmt.run(ts || new Date().toISOString(), kind, JSON.stringify(payload));
  }

  list(kind?: string): ActivityRow[] {
    let query = 'SELECT id, ts, kind, payload FROM activity';
    const params: string[] = [];
    if (kind) {
      query += ' WHERE kind = ?';
      params.push(kind);
    }
    const stmt = this.db.prepare(query);
    const rows = stmt.all(...params) as { id: number; ts: string; kind: string; payload: string }[];
    return rows.map((row) => ({
      ...row,
      payload: JSON.parse(row.payload) as Record<string, unknown>,
    }));
  }
}
