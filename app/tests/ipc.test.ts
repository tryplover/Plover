import { describe, expect, it, vi, beforeEach } from 'vitest';
import { Goal, Task } from '../src/shared/types.js';
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

    expect(mockWindowInstance.webContents.send).toHaveBeenCalledWith('app-event', {
      type: 'goal.created',
      payload: { goalId: mockGoal.id },
    });
  });

  it('forwards task.created events to open BrowserWindow webContents', () => {
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

    const mockTask: Task = {
      id: 'task-1',
      goal_id: 'g-1',
      title: 'Task 1',
      estimate_minutes: 30,
      status: 'todo',
      sort_index: 0,
      progress: 0,
      created_at: '',
      updated_at: '',
    };

    eventBus.emit('task.created', { task: mockTask });

    const windows = BrowserWindow.getAllWindows();
    const mockWindowInstance = windows[0];
    if (!mockWindowInstance) {
      throw new Error('mock window not found');
    }

    expect(mockWindowInstance.webContents.send).toHaveBeenCalledWith('app-event', {
      type: 'task.created',
      payload: { taskId: mockTask.id },
    });
  });

  it('forwards task.updated events to open BrowserWindow webContents', () => {
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

    const mockTask: Task = {
      id: 'task-2',
      goal_id: 'g-1',
      title: 'Task 2',
      estimate_minutes: 30,
      status: 'in_progress',
      sort_index: 0,
      progress: 0.5,
      created_at: '',
      updated_at: '',
    };

    eventBus.emit('task.updated', { task: mockTask });

    const windows = BrowserWindow.getAllWindows();
    const mockWindowInstance = windows[0];
    if (!mockWindowInstance) {
      throw new Error('mock window not found');
    }

    expect(mockWindowInstance.webContents.send).toHaveBeenCalledWith('app-event', {
      type: 'task.updated',
      payload: { taskId: mockTask.id },
    });
  });

  it('forwards task.deleted events to open BrowserWindow webContents', () => {
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

    eventBus.emit('task.deleted', { id: 'task-3' });

    const windows = BrowserWindow.getAllWindows();
    const mockWindowInstance = windows[0];
    if (!mockWindowInstance) {
      throw new Error('mock window not found');
    }

    expect(mockWindowInstance.webContents.send).toHaveBeenCalledWith('app-event', {
      type: 'task.deleted',
      payload: { taskId: 'task-3' },
    });
  });

  it('forwards tasks.reordered events to open BrowserWindow webContents', () => {
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

    eventBus.emit('tasks.reordered', { goal_id: 'g-1', orderedIds: ['task-1', 'task-2'] });

    const windows = BrowserWindow.getAllWindows();
    const mockWindowInstance = windows[0];
    if (!mockWindowInstance) {
      throw new Error('mock window not found');
    }

    expect(mockWindowInstance.webContents.send).toHaveBeenCalledWith('app-event', {
      type: 'tasks.reordered',
      payload: { goalId: 'g-1', orderedIds: ['task-1', 'task-2'] },
    });
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
