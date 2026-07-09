import Database from 'better-sqlite3';

export interface SettingsData {
  googleConnected: boolean;
  workingHours: { start: string; end: string };
  horizonDays: number;
  pauseScheduling: boolean;
  watchedFolders: string[];
  lastInferenceTs: string | null;

  pauseAllTracking: boolean;
  windowTrackingEnabled: boolean;
  gdocsPollingEnabled: boolean;
  fileWatchingEnabled: boolean;
  screenCaptureEnabled: boolean;
  screenCaptureIntervalMinutes: number;
  screenVisionInferenceEnabled: boolean;
  activityRetentionDays: number;
  planner_useRecentActivityContext: boolean;
}

export class SettingsRepo {
  private db: Database.Database;
  private getStmt: Database.Statement;
  private setStmt: Database.Statement;
  private getAllStmt: Database.Statement;
  private deleteStmt: Database.Statement;

  constructor(db: Database.Database) {
    this.db = db;
    this.getStmt = this.db.prepare('SELECT value FROM settings WHERE key = ?');
    this.setStmt = this.db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
    this.getAllStmt = this.db.prepare('SELECT key, value FROM settings');
    this.deleteStmt = this.db.prepare('DELETE FROM settings WHERE key = ?');
  }

  get(key: string): string | null {
    const row = this.getStmt.get(key) as { value: string } | undefined;
    return row ? row.value : null;
  }

  set(key: string, value: string): void {
    this.setStmt.run(key, value);
  }

  getAll(): SettingsData {
    // Optimization: Fetch all settings in a single query to reduce database roundtrips.
    // This reduces roundtrips from ~15 to 1.
    const rows = this.getAllStmt.all() as { key: string; value: string }[];
    const settings = new Map<string, string>();
    for (const row of rows) {
      settings.set(row.key, row.value);
    }

    const getVal = (key: string) => settings.get(key) ?? null;

    const googleConnected = getVal('googleConnected') === 'true';
    const workingHoursRaw = getVal('workingHours');
    const workingHours = workingHoursRaw
      ? JSON.parse(workingHoursRaw)
      : { start: '09:00', end: '18:00' };
    const horizonDays = Number(getVal('horizonDays') ?? '14');
    const pauseScheduling = getVal('pauseScheduling') === 'true';
    const watchedFoldersRaw = getVal('watchedFolders');
    const watchedFolders = watchedFoldersRaw ? JSON.parse(watchedFoldersRaw) : [];
    const lastInferenceTs = getVal('lastInferenceTs');

    const pauseAllTracking = getVal('pauseAllTracking') === 'true';
    const windowTrackingEnabled = getVal('windowTrackingEnabled') !== 'false';
    const gdocsPollingEnabled = getVal('gdocsPollingEnabled') !== 'false';
    const fileWatchingEnabled = getVal('fileWatchingEnabled') !== 'false';
    const screenCaptureEnabled = getVal('screenCaptureEnabled') === 'true';
    const rawInterval = Number(getVal('screenCaptureIntervalMinutes') ?? '5');
    const screenCaptureIntervalMinutes = Math.min(
      60,
      Math.max(1, Number.isFinite(rawInterval) ? Math.round(rawInterval) : 5),
    );
    const screenVisionInferenceEnabled = getVal('screenVisionInferenceEnabled') === 'true';
    const rawRetention = Number(getVal('activityRetentionDays') ?? '30');
    const activityRetentionDays = Math.max(
      0,
      Number.isFinite(rawRetention) ? Math.round(rawRetention) : 30,
    );
    const planner_useRecentActivityContext = getVal('planner_useRecentActivityContext') !== 'false';

    return {
      googleConnected,
      workingHours,
      horizonDays,
      pauseScheduling,
      watchedFolders,
      lastInferenceTs,
      pauseAllTracking,
      windowTrackingEnabled,
      gdocsPollingEnabled,
      fileWatchingEnabled,
      screenCaptureEnabled,
      screenCaptureIntervalMinutes,
      screenVisionInferenceEnabled,
      activityRetentionDays,
      planner_useRecentActivityContext,
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
      this.set('watchedFolders', JSON.stringify(patch.watchedFolders));
    }
    if (patch.lastInferenceTs !== undefined) {
      if (patch.lastInferenceTs === null) {
        this.deleteStmt.run('lastInferenceTs');
      } else {
        this.set('lastInferenceTs', patch.lastInferenceTs);
      }
    }
    if (patch.pauseAllTracking !== undefined) {
      this.set('pauseAllTracking', String(patch.pauseAllTracking));
    }
    if (patch.windowTrackingEnabled !== undefined) {
      this.set('windowTrackingEnabled', String(patch.windowTrackingEnabled));
    }
    if (patch.gdocsPollingEnabled !== undefined) {
      this.set('gdocsPollingEnabled', String(patch.gdocsPollingEnabled));
    }
    if (patch.fileWatchingEnabled !== undefined) {
      this.set('fileWatchingEnabled', String(patch.fileWatchingEnabled));
    }
    if (patch.screenCaptureEnabled !== undefined) {
      this.set('screenCaptureEnabled', String(patch.screenCaptureEnabled));
    }
    if (patch.screenCaptureIntervalMinutes !== undefined) {
      const clamped = Math.min(60, Math.max(1, Math.round(patch.screenCaptureIntervalMinutes)));
      this.set('screenCaptureIntervalMinutes', String(clamped));
    }
    if (patch.screenVisionInferenceEnabled !== undefined) {
      this.set('screenVisionInferenceEnabled', String(patch.screenVisionInferenceEnabled));
    }
    if (patch.activityRetentionDays !== undefined) {
      this.set('activityRetentionDays', String(Math.max(0, Math.round(patch.activityRetentionDays))));
    }
    if (patch.planner_useRecentActivityContext !== undefined) {
      this.set('planner_useRecentActivityContext', String(patch.planner_useRecentActivityContext));
    }
  }
}
