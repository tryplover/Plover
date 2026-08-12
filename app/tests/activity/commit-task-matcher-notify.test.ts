import { describe, it, expect, vi, beforeEach } from 'vitest';

const { NotificationMock } = vi.hoisted(() => {
  return {
    NotificationMock: vi.fn(function () {
      return {
        show: vi.fn(),
      };
    }),
  };
});

vi.mock('electron', () => {
  return {
    Notification: NotificationMock,
  };
});

import { defaultNotify } from '../../src/main/activity/processing/commit-task-matcher/index.js';

describe('defaultNotify', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('instantiates Notification and calls show()', () => {
    const showSpy = vi.fn();
    NotificationMock.mockImplementationOnce(function () {
      return {
        show: showSpy,
      };
    });

    defaultNotify('Test Title', 'Test Body');

    expect(NotificationMock).toHaveBeenCalledWith({
      title: 'Test Title',
      body: 'Test Body',
    });
    expect(showSpy).toHaveBeenCalled();
  });

  it('catches and logs errors during Notification instantiation', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {
      // no-op
    });
    NotificationMock.mockImplementationOnce(function () {
      throw new Error('Instantiation failed');
    });

    defaultNotify('Test Title', 'Test Body');

    expect(consoleSpy).toHaveBeenCalledWith(
      '[CommitTaskMatcher] Notification failed:',
      expect.any(Error),
    );
    const call0 = consoleSpy.mock.calls[0];
    expect(call0?.[1].message).toBe('Instantiation failed');
  });

  it('catches and logs errors during show() call', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {
      // no-op
    });
    const showSpy = vi.fn().mockImplementation(() => {
      throw new Error('Show failed');
    });
    NotificationMock.mockImplementationOnce(function () {
      return {
        show: showSpy,
      };
    });

    defaultNotify('Test Title', 'Test Body');

    expect(showSpy).toHaveBeenCalled();
    expect(consoleSpy).toHaveBeenCalledWith(
      '[CommitTaskMatcher] Notification failed:',
      expect.any(Error),
    );
    const call0 = consoleSpy.mock.calls[0];
    expect(call0?.[1].message).toBe('Show failed');
  });
});
