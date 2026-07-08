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
  private deleteStmt: Database.Statement;
  private getAllStmt: Database.Statement;

  constructor(db: Database.Database) {
    this.db = db;
    // PERFORMANCE: Pre-preparing statements in the constructor avoids the overhead
    // of parsing and compiling SQL on every method call (~0.1-0.5ms saved per call).
    this.getStmt = this.db.prepare('SELECT value FROM settings WHERE key = ?');
    this.setStmt = this.db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
    this.deleteStmt = this.db.prepare('DELETE FROM settings WHERE key = ?');
    this.getAllStmt = this.db.prepare('SELECT key, value FROM settings');
  }

  get(key: string): string | null {
    const row = this.getStmt.get(key) as { value: string } | undefined;
    return row ? row.value : null;
  }

  set(key: string, value: string): void {
    this.setStmt.run(key, value);
  }

  getAll(): SettingsData {
    // PERFORMANCE: Fetching all settings in a single query reduces database roundtrips
    // from N (number of settings) to 1. This significantly improves startup and settings-heavy paths.
    const rows = this.getAllStmt.all() as { key: string; value: string }[];
    const settingsMap = new Map(rows.map((r) => [r.key, r.value]));

    const googleConnected = settingsMap.get('googleConnected') === 'true';
    const workingHoursRaw = settingsMap.get('workingHours') as string | undefined;
    const workingHours = workingHoursRaw
      ? JSON.parse(workingHoursRaw)
      : { start: '09:00', end: '18:00' };
    const horizonDays = Number(settingsMap.get('horizonDays') ?? '14');
    const pauseScheduling = settingsMap.get('pauseScheduling') === 'true';
    const watchedFoldersRaw = settingsMap.get('watchedFolders');
    const watchedFolders = watchedFoldersRaw ? JSON.parse(watchedFoldersRaw) : [];
    const lastInferenceTs = settingsMap.get('lastInferenceTs') ?? null;

    const pauseAllTracking = settingsMap.get('pauseAllTracking') === 'true';
    const windowTrackingEnabled = settingsMap.get('windowTrackingEnabled') !== 'false';
    const gdocsPollingEnabled = settingsMap.get('gdocsPollingEnabled') !== 'false';
    const fileWatchingEnabled = settingsMap.get('fileWatchingEnabled') !== 'false';
    const screenCaptureEnabled = settingsMap.get('screenCaptureEnabled') === 'true';
    const rawInterval = Number(settingsMap.get('screenCaptureIntervalMinutes') ?? '5');
    const screenCaptureIntervalMinutes = Math.min(
      60,
      Math.max(1, Number.isFinite(rawInterval) ? Math.round(rawInterval) : 5),
    );
    const screenVisionInferenceEnabled = settingsMap.get('screenVisionInferenceEnabled') === 'true';
    const rawRetention = Number(settingsMap.get('activityRetentionDays') ?? '30');
    const activityRetentionDays = Math.max(
      0,
      Number.isFinite(rawRetention) ? Math.round(rawRetention) : 30,
    );
    const planner_useRecentActivityContext =
      settingsMap.get('planner_useRecentActivityContext') !== 'false';

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
      this.set(
        'activityRetentionDays',
        String(Math.max(0, Math.round(patch.activityRetentionDays))),
      );
    }
    if (patch.planner_useRecentActivityContext !== undefined) {
      this.set('planner_useRecentActivityContext', String(patch.planner_useRecentActivityContext));
    }
  }
}
