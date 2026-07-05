import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Notifier } from '../src/main/notifier.js';

const { mockShow, mockIsSupported } = vi.hoisted(() => ({
  mockShow: vi.fn(),
  mockIsSupported: vi.fn().mockReturnValue(true),
}));

vi.mock('electron', () => {
  return {
    Notification: class {
      static isSupported = mockIsSupported;
      show = mockShow;
    },
  };
});

describe('Notifier', () => {
  let notifier: Notifier;

  beforeEach(() => {
    vi.clearAllMocks();
    notifier = new Notifier();
  });

  it('shows a notification when supported', () => {
    mockIsSupported.mockReturnValue(true);
    notifier.show('Test Title', 'Test Body');

    expect(mockShow).toHaveBeenCalledTimes(1);
    expect(notifier.getQueue()).toHaveLength(0);
  });

  it('does not queue a notification when not supported', () => {
    mockIsSupported.mockReturnValue(false);
    notifier.show('Queued Title', 'Queued Body');

    expect(mockShow).not.toHaveBeenCalled();
    expect(notifier.getQueue()).toHaveLength(0);
  });

  it('queues a notification when show() throws', () => {
    mockIsSupported.mockReturnValue(true);
    mockShow.mockImplementationOnce(() => {
      throw new Error('Electron notification failed');
    });

    notifier.show('Failing Title', 'Failing Body');

    expect(notifier.getQueue()).toHaveLength(1);
    expect(notifier.getQueue()[0]?.title).toBe('Failing Title');
  });

  it('flushes the queue when a successful notification is shown', () => {
    mockIsSupported.mockReturnValue(true);
    mockShow.mockImplementationOnce(() => {
      throw new Error('Temporary failure');
    });
    notifier.show('First', 'First Body');
    expect(notifier.getQueue()).toHaveLength(1);

    notifier.show('Second', 'Second Body');

    // Should show 'Second' AND flush 'First'
    expect(mockShow).toHaveBeenCalledTimes(2);
    expect(notifier.getQueue()).toHaveLength(0);
  });

  it('respects the maximum queue size', () => {
    mockIsSupported.mockReturnValue(true);
    mockShow.mockImplementation(() => {
      throw new Error('Temporary failure');
    });
    // notifier has maxQueueSize = 50
    for (let i = 0; i < 60; i++) {
      notifier.show(`Title ${i}`, `Body ${i}`);
    }

    const queue = notifier.getQueue();
    expect(queue).toHaveLength(50);
    expect(queue[0]?.title).toBe('Title 10');
    expect(queue[49]?.title).toBe('Title 59');
  });

  it('flushQueue stops on failure and preserves the remaining queue items', () => {
    mockIsSupported.mockReturnValue(true);
    mockShow.mockImplementation(() => {
      throw new Error('Temporary failure');
    });
    notifier.show('Q1', 'B1');
    notifier.show('Q2', 'B2');
    expect(notifier.getQueue()).toHaveLength(2);

    // Reset call count before flushing
    mockShow.mockClear();

    notifier.flushQueue();

    // Q1 failed, so Q2 should not be attempted and should remain in the queue
    expect(mockShow).toHaveBeenCalledTimes(1);
    const queue = notifier.getQueue();
    expect(queue).toHaveLength(1);
    expect(queue[0]?.title).toBe('Q2');
  });
});
