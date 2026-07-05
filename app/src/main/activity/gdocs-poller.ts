import { google } from 'googleapis';
import { Notification } from 'electron';
import { GoogleAuth } from '@main/sync/google-auth';
import { ActivityRepo } from '@main/store/repos/activity';
import { SettingsRepo } from '@main/store/repos/settings';

const MAX_DELAY_MS = 60 * 60 * 1000; // 1 hour
const FAILURE_THRESHOLD = 5;

export class GDocsPoller {
  private googleAuth: GoogleAuth;
  private activityRepo: ActivityRepo;
  private settingsRepo: SettingsRepo;
  private intervalMs: number;
  private timeoutId: NodeJS.Timeout | null = null;
  public lastPollTime: Date;
  private isPolling = false;
  private consecutiveFailures = 0;
  private notify: (title: string, body: string) => void;
  private running = false;

  constructor(
    googleAuth: GoogleAuth,
    activityRepo: ActivityRepo,
    settingsRepo: SettingsRepo,
    intervalMs: number = 10 * 60 * 1000,
    notify: (title: string, body: string) => void = defaultNotify,
  ) {
    this.googleAuth = googleAuth;
    this.activityRepo = activityRepo;
    this.settingsRepo = settingsRepo;
    this.intervalMs = intervalMs;
    this.notify = notify;

    const saved = this.settingsRepo.get('lastGDocsPollTime');
    this.lastPollTime = saved ? new Date(saved) : new Date();
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.scheduleTick(this.intervalMs);
  }

  private scheduleTick(delayMs: number): void {
    if (!this.running) return;
    this.timeoutId = setTimeout(() => {
      this.tick().catch((err) => {
        console.error('Error in GDocsPoller tick:', err);
      });
    }, delayMs);
  }

  private async tick(): Promise<void> {
    if (!this.running) return;
    const success = await this.poll();
    if (!this.running) return;

    if (success) {
      this.consecutiveFailures = 0;
      this.scheduleTick(this.intervalMs);
    } else {
      this.consecutiveFailures++;
      if (this.consecutiveFailures === FAILURE_THRESHOLD) {
        this.notify(
          'Plover',
          'Google Docs polling failed multiple times. Please check your connection.',
        );
      }
      this.scheduleTick(this.calculateNextDelay());
    }
  }

  private calculateNextDelay(): number {
    const backoffFactor = Math.pow(2, this.consecutiveFailures - 1);
    return Math.min(this.intervalMs * backoffFactor, MAX_DELAY_MS);
  }

  stop(): void {
    this.running = false;
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
  }

  async poll(): Promise<boolean> {
    const settings = this.settingsRepo.getAll();
    if (settings.pauseAllTracking || !settings.gdocsPollingEnabled) {
      return true;
    }

    if (settings.googleConnected !== true) {
      return true;
    }

    const isAuthorized = await this.googleAuth.isAuthorized();
    if (!isAuthorized) {
      return true;
    }

    if (this.isPolling) {
      return true;
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
      return true;
    } catch (error) {
      console.error('Failed to poll GDocs revisions:', error);
      return false;
    } finally {
      this.isPolling = false;
    }
  }
}

function defaultNotify(title: string, body: string): void {
  try {
    new Notification({ title, body }).show();
  } catch (err) {
    console.error('[GDocsPoller] Notification failed:', err);
  }
}
