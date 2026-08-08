import Database from 'better-sqlite3';

export interface SettingsData {
  googleConnected: boolean;
  workingHours: { start: string; end: string };
  horizonDays: number;
  pauseScheduling: boolean;
  watchedFolders: string[];
  lastInferenceTs: string | null;
  supabaseUserId: string | null;
  supabaseUserEmail: string | null;

  theme: 'light' | 'dark';
  companionMode: 'full' | 'compact';

  pauseAllTracking: boolean;
  windowTrackingEnabled: boolean;
  gdocsPollingEnabled: boolean;
  fileWatchingEnabled: boolean;
  screenCaptureEnabled: boolean;
  screenCaptureIntervalMinutes: number;
  screenVisionInferenceEnabled: boolean;
  lastVisionInferenceWindowKey: string | null;
  activityRetentionDays: number;
  planner_useRecentActivityContext: boolean;
  progressPopsEnabled: boolean;
  gmailEnabled: boolean;
  calendarEnabled: boolean;
  classroomEnabled: boolean;

  githubConnected: boolean;
  githubTrackingEnabled: boolean;
  githubWatchedRepos: string[];
}

export class SettingsRepo {
  private db: Database.Database;
  private getStmt: Database.Statement;
  private setStmt: Database.Statement;
  private getAllStmt: Database.Statement;
  private deleteStmt: Database.Statement;

  constructor(db: Database.Database) {
    this.db = db;
    /**
     * BOLT ⚡ OPTIMIZATION:
     * Pre-preparing statements in the constructor avoids the overhead of
     * re-compiling SQL on every call.
     */
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
    /**
     * BOLT ⚡ OPTIMIZATION:
     * Batch-retrieval reduces database roundtrips from O(N) to O(1).
     * Previously, this method performed ~13 individual queries.
     * Now it performs a single scan and handles lookups in-memory.
     */
    const rows = this.getAllStmt.all() as { key: string; value: string }[];
    const map = new Map(rows.map((r) => [r.key, r.value]));

    const googleConnected = map.get('googleConnected') === 'true';
    const workingHoursRaw = map.get('workingHours') ?? null;
    const workingHours = workingHoursRaw
      ? JSON.parse(workingHoursRaw)
      : { start: '09:00', end: '18:00' };
    const horizonDays = Number(map.get('horizonDays') ?? '14');
    const pauseScheduling = map.get('pauseScheduling') === 'true';
    const watchedFoldersRaw = map.get('watchedFolders');
    const watchedFolders = watchedFoldersRaw ? JSON.parse(watchedFoldersRaw) : [];
    const lastInferenceTs = map.get('lastInferenceTs') ?? null;
    const supabaseUserId = map.get('supabaseUserId') ?? null;
    const supabaseUserEmail = map.get('supabaseUserEmail') ?? null;

    const rawTheme = map.get('theme');
    const theme: 'light' | 'dark' = rawTheme === 'dark' ? 'dark' : 'light';

    // Compact is the default: the Figma-designed "Full" collapsed pill is too
    // large for a persistent top-of-screen overlay per explicit user feedback.
    // An explicit 'full' choice (via Settings) is still respected either way.
    const rawCompanionMode = map.get('companionMode');
    const companionMode: 'full' | 'compact' = rawCompanionMode === 'full' ? 'full' : 'compact';

    const pauseAllTracking = map.get('pauseAllTracking') === 'true';
    const windowTrackingEnabled = map.get('windowTrackingEnabled') !== 'false';
    const gdocsPollingEnabled = map.get('gdocsPollingEnabled') !== 'false';
    const fileWatchingEnabled = map.get('fileWatchingEnabled') !== 'false';
    const screenCaptureEnabled = map.get('screenCaptureEnabled') === 'true';
    const rawInterval = Number(map.get('screenCaptureIntervalMinutes') ?? '5');
    const screenCaptureIntervalMinutes = Math.min(
      60,
      Math.max(1, Number.isFinite(rawInterval) ? Math.round(rawInterval) : 5),
    );
    const screenVisionInferenceEnabled = map.get('screenVisionInferenceEnabled') === 'true';
    const lastVisionInferenceWindowKey = map.get('lastVisionInferenceWindowKey') ?? null;
    const rawRetention = Number(map.get('activityRetentionDays') ?? '30');
    const activityRetentionDays = Math.max(
      0,
      Number.isFinite(rawRetention) ? Math.round(rawRetention) : 30,
    );
    const planner_useRecentActivityContext =
      map.get('planner_useRecentActivityContext') !== 'false';
    const progressPopsEnabled = map.get('progressPopsEnabled') === 'true';
    const gmailEnabled = map.get('gmailEnabled') !== 'false';
    const calendarEnabled = map.get('calendarEnabled') !== 'false';
    const classroomEnabled = map.get('classroomEnabled') !== 'false';

    const githubConnected = map.get('githubConnected') === 'true';
    const githubTrackingEnabled = map.get('githubTrackingEnabled') !== 'false';
    const githubWatchedReposRaw = map.get('githubWatchedRepos');
    const githubWatchedRepos = githubWatchedReposRaw ? JSON.parse(githubWatchedReposRaw) : [];

    return {
      googleConnected,
      workingHours,
      horizonDays,
      pauseScheduling,
      watchedFolders,
      lastInferenceTs,
      supabaseUserId,
      supabaseUserEmail,
      theme,
      companionMode,
      pauseAllTracking,
      windowTrackingEnabled,
      gdocsPollingEnabled,
      fileWatchingEnabled,
      screenCaptureEnabled,
      screenCaptureIntervalMinutes,
      screenVisionInferenceEnabled,
      lastVisionInferenceWindowKey,
      activityRetentionDays,
      planner_useRecentActivityContext,
      progressPopsEnabled,
      gmailEnabled,
      calendarEnabled,
      classroomEnabled,
      githubConnected,
      githubTrackingEnabled,
      githubWatchedRepos,
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
    if (patch.supabaseUserId !== undefined) {
      if (patch.supabaseUserId === null) {
        this.deleteStmt.run('supabaseUserId');
      } else {
        this.set('supabaseUserId', patch.supabaseUserId);
      }
    }
    if (patch.supabaseUserEmail !== undefined) {
      if (patch.supabaseUserEmail === null) {
        this.deleteStmt.run('supabaseUserEmail');
      } else {
        this.set('supabaseUserEmail', patch.supabaseUserEmail);
      }
    }
    if (patch.theme !== undefined) {
      this.set('theme', patch.theme);
    }
    if (patch.companionMode !== undefined) {
      this.set('companionMode', patch.companionMode);
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
    if (patch.lastVisionInferenceWindowKey !== undefined) {
      if (patch.lastVisionInferenceWindowKey === null) {
        this.deleteStmt.run('lastVisionInferenceWindowKey');
      } else {
        this.set('lastVisionInferenceWindowKey', patch.lastVisionInferenceWindowKey);
      }
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
    if (patch.progressPopsEnabled !== undefined) {
      this.set('progressPopsEnabled', String(patch.progressPopsEnabled));
    }
    if (patch.gmailEnabled !== undefined) {
      this.set('gmailEnabled', String(patch.gmailEnabled));
    }
    if (patch.calendarEnabled !== undefined) {
      this.set('calendarEnabled', String(patch.calendarEnabled));
    }
    if (patch.classroomEnabled !== undefined) {
      this.set('classroomEnabled', String(patch.classroomEnabled));
    }
    if (patch.githubConnected !== undefined) {
      this.set('githubConnected', String(patch.githubConnected));
    }
    if (patch.githubTrackingEnabled !== undefined) {
      this.set('githubTrackingEnabled', String(patch.githubTrackingEnabled));
    }
    if (patch.githubWatchedRepos !== undefined) {
      this.set('githubWatchedRepos', JSON.stringify(patch.githubWatchedRepos));
    }
  }
}
