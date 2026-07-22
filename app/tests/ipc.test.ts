import { describe, expect, it, vi, beforeEach } from 'vitest';
import { Goal } from '../src/shared/types.js';
import { BrowserWindow } from 'electron';

vi.mock('electron', () => {
  const mockSendFn = vi.fn();
  const mockWin = {
    isDestroyed: vi.fn().mockReturnValue(false),
    webContents: {
      send: mockSendFn,
    },
  };
  return {
    ipcMain: {
      handle: vi.fn(),
    },
    BrowserWindow: {
      getAllWindows: vi.fn().mockReturnValue([mockWin]),
    },
  };
});

import { startEventForwarding } from '../src/main/planner/goal-manager.js';
import { eventBus } from '../src/main/events/bus.js';

describe('Event forwarding', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    eventBus.removeAllListeners();
  });

  it('forwards eventBus events to open BrowserWindow webContents', () => {
    const broadcast = (channel: string, payload?: unknown) => {
      for (const win of BrowserWindow.getAllWindows()) {
        if (!win.isDestroyed()) {
          if (payload === undefined) {
            win.webContents.send(channel);
          } else {
            win.webContents.send(channel, payload);
          }
        }
      }
    };
    startEventForwarding(broadcast);

    const mockGoal: Goal = {
      id: 'g-1',
      title: 'Goal 1',
      status: 'active',
      created_at: '',
      updated_at: '',
    };

    eventBus.emit('goal.created', mockGoal);

    const windows = BrowserWindow.getAllWindows();
    const mockWindowInstance = windows[0];
    if (!mockWindowInstance) {
      throw new Error('mock window not found');
    }

    expect(mockWindowInstance.webContents.send).toHaveBeenCalledWith('goal:created', mockGoal);
  });

  it('does not forward events to destroyed windows', () => {
    const broadcast = (channel: string, payload?: unknown) => {
      for (const win of BrowserWindow.getAllWindows()) {
        if (!win.isDestroyed()) {
          if (payload === undefined) {
            win.webContents.send(channel);
          } else {
            win.webContents.send(channel, payload);
          }
        }
      }
    };
    startEventForwarding(broadcast);

    const windows = BrowserWindow.getAllWindows();
    const mockWindowInstance = windows[0];
    if (!mockWindowInstance) {
      throw new Error('mock window not found');
    }

    vi.mocked(mockWindowInstance.isDestroyed).mockReturnValue(true);

    const mockGoal: Goal = {
      id: 'g-2',
      title: 'Goal 2',
      status: 'active',
      created_at: '',
      updated_at: '',
    };

    eventBus.emit('goal.created', mockGoal);

    expect(mockWindowInstance.webContents.send).not.toHaveBeenCalled();
  });
});
