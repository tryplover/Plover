import { describe, expect, it, vi, beforeEach } from 'vitest';
import { registerIpcHandlers } from '../../src/main/ipc';
import { ipcMain } from 'electron';
import { ProposedPlan } from '../../src/preload/index';
import { BrowserWindow } from 'electron';

type IpcHandler = (event: unknown, ...args: unknown[]) => unknown;

// Mock electron
vi.mock('electron', () => {
  const handlers: Record<string, IpcHandler> = {};
  return {
    ipcMain: {
      handle: vi.fn((channel: string, handler: IpcHandler) => {
        handlers[channel] = handler;
      }),
    },
    BrowserWindow: vi.fn(),
  };
});

interface MockOverlayWindow {
  hide: ReturnType<typeof vi.fn>;
  getBounds: ReturnType<typeof vi.fn>;
  setBounds: ReturnType<typeof vi.fn>;
  setSize: ReturnType<typeof vi.fn>;
  center: ReturnType<typeof vi.fn>;
  show: ReturnType<typeof vi.fn>;
  focus: ReturnType<typeof vi.fn>;
}

describe('IPC Handlers', () => {
  let mockOverlayWindow: MockOverlayWindow;
  let getOverlayWindow: () => BrowserWindow | null;

  beforeEach(() => {
    vi.clearAllMocks();
    mockOverlayWindow = {
      hide: vi.fn(),
      getBounds: vi.fn().mockReturnValue({ x: 10, y: 20, width: 600, height: 80 }),
      setBounds: vi.fn(),
      setSize: vi.fn(),
      center: vi.fn(),
      show: vi.fn(),
      focus: vi.fn(),
    };
    getOverlayWindow = () => mockOverlayWindow as unknown as BrowserWindow;
    registerIpcHandlers(getOverlayWindow);
  });

  it('registers handlers for goal:propose, goal:commit, overlay:close, overlay:resize', () => {
    expect(ipcMain.handle).toHaveBeenCalledWith('goal:propose', expect.any(Function));
    expect(ipcMain.handle).toHaveBeenCalledWith('goal:commit', expect.any(Function));
    expect(ipcMain.handle).toHaveBeenCalledWith('overlay:close', expect.any(Function));
    expect(ipcMain.handle).toHaveBeenCalledWith('overlay:resize', expect.any(Function));
  });

  it('handles goal:propose by generating a plan with subtasks', async () => {
    const calls = (ipcMain.handle as ReturnType<typeof vi.fn>).mock.calls;
    const proposeCall = calls.find((call) => call[0] === 'goal:propose');
    expect(proposeCall).toBeDefined();

    const handler = proposeCall?.[1] as (event: unknown, goalText: string) => Promise<ProposedPlan>;
    const result = await handler({}, 'Write an essay on octopuses');

    expect(result.goal.title).toBe('Write an essay on octopuses');
    expect(result.subtasks.length).toBeGreaterThan(0);
    expect(result.subtasks[0]?.title).toBe('Research and gather sources');
  });

  it('handles goal:commit by saving and hiding the window', async () => {
    const calls = (ipcMain.handle as ReturnType<typeof vi.fn>).mock.calls;
    const commitCall = calls.find((call) => call[0] === 'goal:commit');
    expect(commitCall).toBeDefined();

    const handler = commitCall?.[1] as (
      event: unknown,
      plan: ProposedPlan,
    ) => Promise<{ goalId: string }>;
    const plan: ProposedPlan = {
      goal: { title: 'Test Goal', description: 'desc', deadline: '2026-06-01' },
      subtasks: [
        { title: 'Subtask 1', estimate_minutes: 30, scheduled_start: '...', scheduled_end: '...' },
      ],
    };

    const result = await handler({}, plan);
    expect(result.goalId).toBeDefined();
    expect(mockOverlayWindow.hide).toHaveBeenCalled();
  });

  it('handles overlay:close by hiding the window', async () => {
    const calls = (ipcMain.handle as ReturnType<typeof vi.fn>).mock.calls;
    const closeCall = calls.find((call) => call[0] === 'overlay:close');
    expect(closeCall).toBeDefined();

    const handler = closeCall?.[1] as (event: unknown) => Promise<void>;
    await handler({});
    expect(mockOverlayWindow.hide).toHaveBeenCalled();
  });

  it('handles overlay:resize by setting bounds if height changed', async () => {
    const calls = (ipcMain.handle as ReturnType<typeof vi.fn>).mock.calls;
    const resizeCall = calls.find((call) => call[0] === 'overlay:resize');
    expect(resizeCall).toBeDefined();

    const handler = resizeCall?.[1] as (event: unknown, height: number) => Promise<void>;

    // Height changes
    await handler({}, 200);
    expect(mockOverlayWindow.setBounds).toHaveBeenCalledWith({
      x: 10,
      y: 20,
      width: 600,
      height: 200,
    });

    // Height does not change
    mockOverlayWindow.setBounds.mockClear();
    await handler({}, 80);
    expect(mockOverlayWindow.setBounds).not.toHaveBeenCalled();
  });
});
