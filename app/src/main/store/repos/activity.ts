import Database from 'better-sqlite3';
import {
  ActivityRow,
  WindowFocusSchema,
  GDocsRevisionSchema,
  GmailMessageSchema,
  CalendarEventSchema,
  ScreenshotCapturedSchema,
  ScreenshotInferredSchema,
  FileEventSchema,
  GitCommitSchema,
} from './activity-types.js';

export type { ActivityRow };

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

  private parseRow(row: ActivityDbRow): ActivityRow {
    let rawPayload: unknown;
    try {
      rawPayload = JSON.parse(row.payload);
    } catch {
      rawPayload = {};
    }

    const payload = (typeof rawPayload === 'object' && rawPayload !== null)
      ? (rawPayload as Record<string, unknown>)
      : {};

    switch (row.kind) {
      case 'window_focus': {
        const result = WindowFocusSchema.safeParse(payload);
        if (result.success) {
          return { id: row.id, ts: row.ts, kind: 'window_focus', payload: result.data };
        }
        break;
      }
      case 'gdocs_revision': {
        const result = GDocsRevisionSchema.safeParse(payload);
        if (result.success) {
          return { id: row.id, ts: row.ts, kind: 'gdocs_revision', payload: result.data };
        }
        break;
      }
      case 'gmail_message': {
        const result = GmailMessageSchema.safeParse(payload);
        if (result.success) {
          return { id: row.id, ts: row.ts, kind: 'gmail_message', payload: result.data };
        }
        break;
      }
      case 'calendar_event': {
        const result = CalendarEventSchema.safeParse(payload);
        if (result.success) {
          return { id: row.id, ts: row.ts, kind: 'calendar_event', payload: result.data };
        }
        break;
      }
      case 'screenshot_captured': {
        const result = ScreenshotCapturedSchema.safeParse(payload);
        if (result.success) {
          return { id: row.id, ts: row.ts, kind: 'screenshot_captured', payload: result.data };
        }
        break;
      }
      case 'screenshot_inferred': {
        const result = ScreenshotInferredSchema.safeParse(payload);
        if (result.success) {
          return { id: row.id, ts: row.ts, kind: 'screenshot_inferred', payload: result.data };
        }
        break;
      }
      case 'file_added': {
        const result = FileEventSchema.safeParse(payload);
        if (result.success) {
          return { id: row.id, ts: row.ts, kind: 'file_added', payload: result.data };
        }
        break;
      }
      case 'file_modified': {
        const result = FileEventSchema.safeParse(payload);
        if (result.success) {
          return { id: row.id, ts: row.ts, kind: 'file_modified', payload: result.data };
        }
        break;
      }
      case 'git_commit': {
        const result = GitCommitSchema.safeParse(payload);
        if (result.success) {
          return { id: row.id, ts: row.ts, kind: 'git_commit', payload: result.data };
        }
        break;
      }
    }

    return {
      id: row.id,
      ts: row.ts,
      kind: row.kind,
      payload: payload,
    } as ActivityRow;
  }

  insert(row: { kind: string; payload: Record<string, unknown>; ts?: string }): ActivityRow {
    const ts = row.ts || new Date().toISOString();
    const result = this.insertStmt.run(ts, row.kind, JSON.stringify(row.payload));

    const id = result.lastInsertRowid as number;

    // We can't easily use parseRow here because it expects ActivityDbRow (with string payload)
    // and returns ActivityRow. We want to avoid redundant JSON operations.
    // However, for consistency and to ensure we return the same structure as retrieval,
    // we use a simplified version of parseRow logic.

    const kind = row.kind;
    const payload = row.payload;

    // We return ActivityRow, but we don't strictly need to safeParse here since
    // the input comes from the app itself, but to satisfy the return type:
    return {
      id,
      ts,
      kind,
      payload,
    } as ActivityRow;
  }

  listSince(ts: string): ActivityRow[] {
    const rows = this.listSinceStmt.all(ts) as ActivityDbRow[];
    return rows.map((row) => this.parseRow(row));
  }

  listBetween(start: string, end: string): ActivityRow[] {
    const rows = this.listBetweenStmt.all(start, end) as ActivityDbRow[];
    return rows.map((row) => this.parseRow(row));
  }

  log(kind: string, payload: Record<string, unknown>, ts?: string): void {
    this.insert({ kind, payload, ts });
  }

  list(filter?: { kind?: string; kinds?: string[]; since?: string; until?: string; limit?: number; offset?: number }): ActivityRow[] {
    const where: string[] = [];
    const params: unknown[] = [];
    if (filter?.kind) {
      where.push('kind = ?');
      params.push(filter.kind);
    }
    if (filter?.kinds && filter.kinds.length > 0) {
      where.push(`kind IN (${filter.kinds.map(() => '?').join(',')})`);
      params.push(...filter.kinds);
    }
    if (filter?.since) {
      where.push('ts >= ?');
      params.push(filter.since);
    }
    if (filter?.until) {
      where.push('ts <= ?');
      params.push(filter.until);
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const limitVal = filter?.limit !== undefined ? Number(filter.limit) : NaN;
    const offsetVal = filter?.offset !== undefined ? Number(filter.offset) : NaN;
    const limitSql = Number.isFinite(limitVal) ? ` LIMIT ${Math.max(1, Math.min(1000, Math.round(limitVal)))}` : '';
    const offsetSql = Number.isFinite(offsetVal) ? ` OFFSET ${Math.max(0, Math.round(offsetVal))}` : '';
    const rows = this.db
      .prepare(`SELECT id, ts, kind, payload FROM activity ${whereSql} ORDER BY ts DESC${limitSql}${offsetSql}`)
      .all(...params) as ActivityDbRow[];
    return rows.map((row) => this.parseRow(row));
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
    return this.parseRow(row);
  }

  getByIds(ids: number[]): ActivityRow[] {
    if (ids.length === 0) return [];
    const placeholders = ids.map(() => '?').join(',');
    const rows = this.db
      .prepare(`SELECT id, ts, kind, payload FROM activity WHERE id IN (${placeholders})`)
      .all(...ids) as ActivityDbRow[];
    return rows.map((row) => this.parseRow(row));
  }
}
