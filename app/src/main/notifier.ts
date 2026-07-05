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
      console.warn('[Notifier] Notifications are not supported on this platform.');
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

    for (let i = 0; i < toProcess.length; i++) {
      const item = toProcess[i];
      try {
        new Notification({ title: item.title, body: item.body }).show();
      } catch (err) {
        console.error('[Notifier] Failed to flush notification from queue:', err);
        // Stop flushing and preserve the remaining unprocessed notifications in the queue.
        // We discard the failed one to avoid potential infinite retry loops for permanently unshowable notifications.
        const remaining = toProcess.slice(i + 1);
        this.queue = [...remaining, ...this.queue];
        if (this.queue.length > this.maxQueueSize) {
          this.queue = this.queue.slice(-this.maxQueueSize);
        }
        break;
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
