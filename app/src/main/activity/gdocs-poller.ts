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
    this.lastPollTime = new Date();
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
    if (settings.googleConnected !== true) {
      return;
    }

    const isAuthorized = await this.googleAuth.isAuthorized();
    if (!isAuthorized) {
      return;
    }

    try {
      console.log('--- GDOC POLL DEBUG ---');
      console.log('googleAuth client:', this.googleAuth?.client);
      console.log('typeof googleAuth.client.request:', typeof this.googleAuth?.client?.request);
      console.log('-----------------------');
      const drive = google.drive({ version: 'v3', auth: this.googleAuth.client });
      const response = await drive.files.list({
        q: `mimeType = 'application/vnd.google-apps.document' and modifiedTime > '${this.lastPollTime.toISOString()}' and trashed = false`,
        fields: 'files(id, name, modifiedTime)',
        orderBy: 'modifiedTime asc',
      });

      const files = response.data.files || [];
      for (const file of files) {
        if (file.id && file.modifiedTime) {
          const fileId = file.id;
          const name = file.name || 'Untitled Document';
          const modifiedTime = file.modifiedTime;

          this.activityRepo.log('gdocs_revision', {
            fileId,
            name,
            modifiedTime,
          });

          const fileTime = new Date(modifiedTime);
          if (fileTime > this.lastPollTime) {
            this.lastPollTime = fileTime;
          }
        }
      }
    } catch (error) {
      console.error('Failed to poll GDocs revisions:', error);
    }
  }
}
