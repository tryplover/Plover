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

  log(kind: string, payload: Record<string, unknown>, ts?: string): void {
    this.insert({ kind, payload, ts });
  }

  logMany(activities: { kind: string; payload: Record<string, unknown>; ts?: string }[]): void {
    if (activities.length === 0) return;
    const transaction = this.db.transaction((items) => {
      for (const item of items) {
        this.log(item.kind, item.payload, item.ts);
      }
    });
    transaction(activities);
  }

  list(filter?: { kind?: string; kinds?: string[]; since?: string; until?: string; limit?: number; offset?: number }): ActivityRow[] {
    const where: string[] = [];
    const params: unknown[] = [];
    if (filter?.kind) { where.push('kind = ?'); params.push(filter.kind); }
    if (filter?.kinds && filter.kinds.length > 0) {
      where.push(`kind IN (${filter.kinds.map(() => '?').join(',')})`);
      params.push(...filter.kinds);
    }
    if (filter?.since) { where.push('ts >= ?'); params.push(filter.since); }
    if (filter?.until) { where.push('ts <= ?'); params.push(filter.until); }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const limitVal = filter?.limit !== undefined ? Number(filter.limit) : NaN;
    const offsetVal = filter?.offset !== undefined ? Number(filter.offset) : NaN;
    const limitSql = Number.isFinite(limitVal) ? ` LIMIT ${Math.max(1, Math.min(1000, Math.round(limitVal)))}` : '';
    const offsetSql = Number.isFinite(offsetVal) ? ` OFFSET ${Math.max(0, Math.round(offsetVal))}` : '';
    const rows = this.db
      .prepare(`SELECT id, ts, kind, payload FROM activity ${whereSql} ORDER BY ts DESC${limitSql}${offsetSql}`)
      .all(...params) as ActivityDbRow[];
    return rows.map((row) => ({ id: row.id, ts: row.ts, kind: row.kind, payload: JSON.parse(row.payload) as Record<string, unknown> }));
  }

  purge(args: { olderThan?: string; ids?: number[] }): { deleted: number } {
    if (args.ids && args.ids.length > 0) {
      const placeholders = args.ids.map(() => '?').join(',');
      const stmt = this.db.prepare(`DELETE FROM activity WHERE id IN (${placeholders})`);
      const result = stmt.run(...args.ids);
      return { deleted: Number(result.changes) };
    }
    if (args.olderThan) {
      const stmt = this.db.prepare('DELETE FROM activity WHERE ts < ?');
      const result = stmt.run(args.olderThan);
      return { deleted: Number(result.changes) };
    }
    return { deleted: 0 };
  }

  getById(id: number): ActivityRow | null {
    const row = this.db
      .prepare('SELECT id, ts, kind, payload FROM activity WHERE id = ?')
      .get(id) as ActivityDbRow | undefined;
    if (!row) return null;
    return {
      id: row.id,
      ts: row.ts,
      kind: row.kind,
      payload: JSON.parse(row.payload) as Record<string, unknown>,
    };
  }

  getByIds(ids: number[]): ActivityRow[] {
    if (ids.length === 0) return [];
    const placeholders = ids.map(() => '?').join(',');
    const rows = this.db
      .prepare(`SELECT id, ts, kind, payload FROM activity WHERE id IN (${placeholders})`)
      .all(...ids) as ActivityDbRow[];
    return rows.map((row) => ({
      id: row.id,
      ts: row.ts,
      kind: row.kind,
      payload: JSON.parse(row.payload) as Record<string, unknown>,
    }));
  }
}
