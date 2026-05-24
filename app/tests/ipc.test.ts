import { describe, expect, it, vi, beforeEach } from 'vitest';
import { Goal } from '../src/shared/types.js';
import { ipcMain, BrowserWindow } from 'electron';

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

import { registerIpcHandlers, startEventForwarding, type IpcHandlers } from '../src/main/ipc.js';
import { eventBus } from '../src/main/bus.js';

describe('IPC Layer', () => {
  let mockHandlers: IpcHandlers;

  beforeEach(() => {
    vi.clearAllMocks();
    eventBus.removeAllListeners();

    mockHandlers = {
      goals: {
        create: vi.fn(),
        get: vi.fn(),
        list: vi.fn(),
        update: vi.fn(),
      },
      tasks: {
        create: vi.fn(),
        get: vi.fn(),
        listByGoal: vi.fn(),
        listScheduledBetween: vi.fn(),
        update: vi.fn(),
      },
      planner: {
        decompose: vi.fn(),
        schedule: vi.fn(),
      },
      calendar: {
        connect: vi.fn(),
        disconnect: vi.fn(),
        getConnectionStatus: vi.fn(),
      },
      settings: {
        get: vi.fn(),
        update: vi.fn(),
      },
      overlay: {
        hide: vi.fn(),
      },
    };
  });

  it('should register handlers with ipcMain.handle', () => {
    registerIpcHandlers(mockHandlers);

    const handleMock = vi.mocked(ipcMain.handle);
    const registeredChannels = handleMock.mock.calls.map((call) => call[0]);

    expect(registeredChannels).toContain('goals:create');
    expect(registeredChannels).toContain('goals:get');
    expect(registeredChannels).toContain('goals:list');
    expect(registeredChannels).toContain('goals:update');

    expect(registeredChannels).toContain('tasks:create');
    expect(registeredChannels).toContain('tasks:get');
    expect(registeredChannels).toContain('tasks:listByGoal');
    expect(registeredChannels).toContain('tasks:listScheduledBetween');
    expect(registeredChannels).toContain('tasks:update');

    expect(registeredChannels).toContain('planner:decompose');
    expect(registeredChannels).toContain('planner:schedule');

    expect(registeredChannels).toContain('calendar:connect');
    expect(registeredChannels).toContain('calendar:disconnect');
    expect(registeredChannels).toContain('calendar:getConnectionStatus');

    expect(registeredChannels).toContain('settings:get');
    expect(registeredChannels).toContain('settings:update');
    expect(registeredChannels).toContain('overlay:hide');
  });

  it('should route IPC handles to correct handlers', async () => {
    registerIpcHandlers(mockHandlers);

    const handleMock = vi.mocked(ipcMain.handle);
    const handlersMap: Record<string, (event: unknown, ...args: unknown[]) => Promise<unknown>> =
      {};
    handleMock.mock.calls.forEach((call) => {
      const channel = call[0] as string;
      const callback = call[1] as (event: unknown, ...args: unknown[]) => Promise<unknown>;
      handlersMap[channel] = callback;
    });

    const mockGoal: Goal = {
      id: 'g-1',
      title: 'Goal 1',
      status: 'active',
      created_at: '',
      updated_at: '',
    };

    vi.mocked(mockHandlers.goals.create).mockResolvedValue(mockGoal);
    const goalsCreateHandler = handlersMap['goals:create'];
    if (!goalsCreateHandler) {
      throw new Error('goals:create handler not registered');
    }
    const resultGoal = await goalsCreateHandler(null, { title: 'Goal 1' });
    expect(mockHandlers.goals.create).toHaveBeenCalledWith({ title: 'Goal 1' });
    expect(resultGoal).toEqual(mockGoal);

    const mockSettings = {
      workingHours: { start: '09:00', end: '17:00' },
      horizonDays: 7,
      pauseScheduling: true,
    };
    vi.mocked(mockHandlers.settings.get).mockResolvedValue(mockSettings);
    const settingsGetHandler = handlersMap['settings:get'];
    if (!settingsGetHandler) {
      throw new Error('settings:get handler not registered');
    }
    const resultSettings = await settingsGetHandler(null);
    expect(mockHandlers.settings.get).toHaveBeenCalled();
    expect(resultSettings).toEqual(mockSettings);
  });

  it('should forward eventBus events to open BrowserWindow webContents', () => {
    startEventForwarding();

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

    eventBus.emit('calendar.synced');
    expect(mockWindowInstance.webContents.send).toHaveBeenCalledWith('calendar:synced');
  });

  it('should not forward events to destroyed windows', () => {
    startEventForwarding();

    const windows = BrowserWindow.getAllWindows();
    const mockWindowInstance = windows[0];
    if (!mockWindowInstance) {
      throw new Error('mock window not found');
    }

    vi.mocked(mockWindowInstance.isDestroyed).mockReturnValueOnce(true);

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
