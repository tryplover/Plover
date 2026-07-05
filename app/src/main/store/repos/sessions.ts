import Database from 'better-sqlite3';

export class SessionsRepo {
  private db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
  }
}
