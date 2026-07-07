import { google } from 'googleapis';
import { GoogleAuth } from './google-auth.js';
import { SettingsRepo } from '../store/repos/settings.js';
import { TypedEventBus } from '../bus.js';

export class GDocsPoller {
  private googleAuth: GoogleAuth;
  private settingsRepo: SettingsRepo;
  private eventBus: TypedEventBus;
  private intervalMs: number;
  private intervalId: NodeJS.Timeout | null = null;
  public lastPollTime: Date;
  private isPolling = false;

  constructor(
    googleAuth: GoogleAuth,
    settingsRepo: SettingsRepo,
    eventBus: TypedEventBus,
    intervalMs: number = 10 * 60 * 1000,
  ) {
    this.googleAuth = googleAuth;
    this.settingsRepo = settingsRepo;
    this.eventBus = eventBus;
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const drive = google.drive({ version: 'v3', auth: this.googleAuth.client as any });
      const response = await drive.files.list({
        q: `mimeType = 'application/vnd.google-apps.document' and modifiedTime > '${this.lastPollTime.toISOString()}' and trashed = false`,
        fields: 'files(id, name, modifiedTime)',
        orderBy: 'modifiedTime asc',
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const files = (response.data as any).files || [];
      for (const file of files) {
        if (file.id && file.modifiedTime) {
          const fileId = file.id;
          const name = file.name || 'Untitled Document';
          const modifiedTime = file.modifiedTime;

          this.eventBus.emit('gdocs.revision', {
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
    } catch (error) {
      console.error('Failed to poll GDocs revisions:', error);
    } finally {
      this.isPolling = false;
    }
  }
}
