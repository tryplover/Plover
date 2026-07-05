import { Notification } from 'electron';

export interface QueuedNotification {
  title: string;
  body: string;
  timestamp: number;
}

export class Notifier {
  private queue: QueuedNotification[] = [];
  private maxQueueSize = 50;

  /**
   * Shows a system notification or queues it if display fails or is unsupported.
   */
  show(title: string, body: string): void {
    if (!Notification.isSupported()) {
      this.enqueue(title, body);
      return;
    }

    try {
      new Notification({ title, body }).show();
      // If we successfully showed a notification, try to flush any previously failed ones.
      if (this.queue.length > 0) {
        this.flushQueue();
      }
    } catch (err) {
      console.error('[Notifier] Notification failed:', err);
      this.enqueue(title, body);
    }
  }

  private enqueue(title: string, body: string): void {
    this.queue.push({ title, body, timestamp: Date.now() });
    if (this.queue.length > this.maxQueueSize) {
      this.queue.shift();
    }
  }

  /**
   * Attempts to display all queued notifications.
   */
  flushQueue(): void {
    if (!Notification.isSupported() || this.queue.length === 0) return;

    const toProcess = [...this.queue];
    this.queue = [];

    for (const item of toProcess) {
      if (!item) continue;
      try {
        new Notification({ title: item.title, body: item.body }).show();
      } catch (err) {
        console.error('[Notifier] Failed to flush notification from queue:', err);
        // If it fails again, we don't re-queue to avoid potential infinite retry loops
        // for notifications that might be permanently unshowable.
      }
    }
  }

  /**
   * Returns a copy of the current queue.
   */
  getQueue(): QueuedNotification[] {
    return [...this.queue];
  }
}

export const notifier = new Notifier();
