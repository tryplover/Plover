import Database from 'better-sqlite3';

export interface SettingsData {
  googleConnected: boolean;
  workingHours: { start: string; end: string };
  horizonDays: number;
  pauseScheduling: boolean;
  watchedFolders?: string[];
}

export class SettingsRepo {
  private db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
  }

  get(key: string): string | string[] | null {
    const stmt = this.db.prepare('SELECT value FROM settings WHERE key = ?');
    const row = stmt.get(key) as { value: string } | undefined;
    if (!row) return null;
    if (key === 'watchedFolders') {
      try {
        return JSON.parse(row.value);
      } catch {
        return [];
      }
    }
    return row.value;
  }

  set(key: string, value: string | string[]): void {
    const stmt = this.db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
    const strValue = typeof value === 'string' ? value : JSON.stringify(value);
    stmt.run(key, strValue);
  }

  getAll(): SettingsData {
    const googleConnected = this.get('googleConnected') === 'true';
    const workingHoursRaw = this.get('workingHours') as string | null;
    const workingHours = workingHoursRaw
      ? JSON.parse(workingHoursRaw)
      : { start: '09:00', end: '18:00' };
    const horizonDays = Number(this.get('horizonDays') ?? '14');
    const pauseScheduling = this.get('pauseScheduling') === 'true';
    const watchedFolders = (this.get('watchedFolders') as string[] | null) ?? [];

    return {
      googleConnected,
      workingHours,
      horizonDays,
      pauseScheduling,
      watchedFolders,
    };
  }

  update(patch: Partial<SettingsData>): void {
    if (patch.googleConnected !== undefined) {
      this.set('googleConnected', String(patch.googleConnected));
    }
    if (patch.workingHours !== undefined) {
      this.set('workingHours', JSON.stringify(patch.workingHours));
    }
    if (patch.horizonDays !== undefined) {
      this.set('horizonDays', String(patch.horizonDays));
    }
    if (patch.pauseScheduling !== undefined) {
      this.set('pauseScheduling', String(patch.pauseScheduling));
    }
    if (patch.watchedFolders !== undefined) {
      this.set('watchedFolders', patch.watchedFolders);
    }
  }
}
