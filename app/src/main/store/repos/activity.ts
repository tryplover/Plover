import Database from 'better-sqlite3';

export class ActivityRepo {
  private db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
  }
}
