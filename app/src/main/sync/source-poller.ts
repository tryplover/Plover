import { SettingsRepo, SettingsData } from '../store/repos/settings.js';
import { SyncCursorsRepo } from '../store/repos/sync-cursors.js';

export interface ContextSource {
  provider: string;
  source: string;
  enabled(settings: SettingsData): boolean;
  poll(cursor: string | null): Promise<string>;
}

export class SourcePoller {
  private intervalId: NodeJS.Timeout | null = null;
  private isPolling = false;

  constructor(
    private source: ContextSource,
    private cursors: SyncCursorsRepo,
    private settingsRepo: SettingsRepo,
    private intervalMs: number,
    private preflight?: () => Promise<boolean>,
  ) {}

  start(): void {
    if (this.intervalId) return;
    this.intervalId = setInterval(() => {
      this.poll().catch((err) => console.error(`Error in SourcePoller(${this.source.source}) tick:`, err));
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
    if (settings.pauseAllTracking) return;
    if (!this.source.enabled(settings)) return;
    if (this.preflight && !(await this.preflight())) return;
    if (this.isPolling) return;
    this.isPolling = true;
    try {
      const cursor = this.cursors.get(this.source.provider, this.source.source);
      const next = await this.source.poll(cursor);
      if (next && next !== cursor) {
        this.cursors.set(this.source.provider, this.source.source, next);
      }
    } catch (error) {
      console.error(`Failed to poll ${this.source.provider}/${this.source.source}:`, error);
    } finally {
      this.isPolling = false;
    }
  }
}
