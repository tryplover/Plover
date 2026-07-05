import { google } from 'googleapis';
import { GoogleAuth } from '@main/sync/google-auth';
import { ActivityRepo } from '@main/store/repos/activity';
import { SettingsRepo } from '@main/store/repos/settings';
import { createPoller } from '@main/lib/poller.js';

export class GDocsPoller {
  private googleAuth: GoogleAuth;
  private activityRepo: ActivityRepo;
  private settingsRepo: SettingsRepo;
  private poller: ReturnType<typeof createPoller>;
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

    const saved = this.settingsRepo.get('lastGDocsPollTime');
    this.lastPollTime = saved ? new Date(saved) : new Date();

    this.poller = createPoller({
      label: 'GDocsPoller',
      intervalMs,
      onTick: () => this.poll(),
    });
  }

  start(): void {
    this.poller.start();
  }

  stop(): void {
    this.poller.stop();
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
          this.settingsRepo.set('lastGDocsPollTime', this.lastPollTime.toISOString());
        }
      }
    }
  }
}
