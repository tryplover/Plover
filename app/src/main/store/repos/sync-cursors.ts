import Database from 'better-sqlite3';

export class SyncCursorsRepo {
  private getStmt: Database.Statement;
  private setStmt: Database.Statement;
  private clearStmt: Database.Statement;

  constructor(private db: Database.Database) {
    this.getStmt = db.prepare('SELECT cursor FROM sync_cursors WHERE provider = ? AND source = ?');
    this.setStmt = db.prepare(`
      INSERT INTO sync_cursors (provider, source, cursor, updated_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(provider, source) DO UPDATE SET cursor = excluded.cursor, updated_at = excluded.updated_at
    `);
    this.clearStmt = db.prepare('DELETE FROM sync_cursors WHERE provider = ?');
  }

  get(provider: string, source: string): string | null {
    const row = this.getStmt.get(provider, source) as { cursor: string } | undefined;
    return row ? row.cursor : null;
  }

  set(provider: string, source: string, cursor: string): void {
    this.setStmt.run(provider, source, cursor, new Date().toISOString());
  }

  clear(provider: string): void {
    this.clearStmt.run(provider);
  }
}
