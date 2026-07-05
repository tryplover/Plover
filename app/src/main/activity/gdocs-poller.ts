import { google } from 'googleapis';
import { GoogleAuth } from '@main/sync/google-auth';
import { ActivityRepo } from '@main/store/repos/activity';
import { SettingsRepo } from '@main/store/repos/settings';

export class GDocsPoller {
  private googleAuth: GoogleAuth;
  private activityRepo: ActivityRepo;
  private settingsRepo: SettingsRepo;
  private intervalMs: number;
  private intervalId: NodeJS.Timeout | null = null;
  public lastPollTime: Date;
  private isPolling = false;

  constructor(
    googleAuth: GoogleAuth,
    activityRepo: ActivityRepo,
    settingsRepo: SettingsRepo,
    intervalMs: number = 10 * 60 * 1000,
  ) {
    this.googleAuth = googleAuth;
    this.activityRepo = activityRepo;
    this.settingsRepo = settingsRepo;
    this.intervalMs = intervalMs;

    const saved = this.settingsRepo.get('lastGDocsPollTime');
    this.lastPollTime = saved ? new Date(saved) : new Date();
  }

  start(): void {
    if (this.intervalId) return;
    this.intervalId = setInterval(() => {
      this.poll().catch((err) => {
        console.error('Error in GDocsPoller interval tick:', err);
      });
    }, this.intervalMs);
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  async poll(): Promise<void> {
    const settings = this.settingsRepo.getAll();
    if (settings.pauseAllTracking || !settings.gdocsPollingEnabled) {
      return;
    }

    if (settings.googleConnected !== true) {
      return;
    }

    const isAuthorized = await this.googleAuth.isAuthorized();
    if (!isAuthorized) {
      return;
    }

    if (this.isPolling) {
      return;
    }
    this.isPolling = true;

    try {
      const drive = google.drive({ version: 'v3', auth: this.googleAuth.client });
      const response = await drive.files.list({
        q: `mimeType = 'application/vnd.google-apps.document' and modifiedTime > '${this.lastPollTime.toISOString()}' and trashed = false`,
        fields: 'files(id, name, modifiedTime)',
        orderBy: 'modifiedTime asc',
      });

      const files = response.data.files || [];
      const activities: { kind: string; payload: Record<string, unknown>; ts?: string }[] = [];
      let latestTime = this.lastPollTime;

      for (const file of files) {
        if (file.id && file.modifiedTime) {
          const fileId = file.id;
          const name = file.name || 'Untitled Document';
          const modifiedTime = file.modifiedTime;

          activities.push({
            kind: 'gdocs_revision',
            payload: {
              fileId,
              name,
              modifiedTime,
            },
            ts: modifiedTime,
          });

          const fileTime = new Date(modifiedTime);
          if (fileTime > latestTime) {
            latestTime = fileTime;
          }
        }
      }

      if (activities.length > 0) {
        this.activityRepo.logMany(activities);
      }

      if (latestTime > this.lastPollTime) {
        this.lastPollTime = latestTime;
        this.settingsRepo.set('lastGDocsPollTime', this.lastPollTime.toISOString());
      }
    } catch (error) {
      console.error('Failed to poll GDocs revisions:', error);
    } finally {
      this.isPolling = false;
    }
  }
}
