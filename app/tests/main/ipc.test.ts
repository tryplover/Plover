import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { setupIpcHandlers, calendarSync } from '../../src/main/ipc';
import { tasksRepo, settingsRepo, activityRepo } from '../../src/main/store';
import { ipcMain } from 'electron';
import { ProposedPlan } from '../../src/preload/index';
import { BrowserWindow } from 'electron';
import * as nodeFs from 'node:fs';

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

vi.mock('keytar', () => ({
  default: {
    getPassword: vi.fn().mockResolvedValue(null),
    setPassword: vi.fn().mockResolvedValue(undefined),
    deletePassword: vi.fn().mockResolvedValue(true),
  }
}));

// Mock planner functions to avoid real network/Gemini API calls
vi.mock('../../src/main/planner/decompose', () => ({
  decomposeGoal: vi.fn().mockResolvedValue({
    goal: { title: 'Write an essay on octopuses', description: 'desc', deadline: '2026-06-01' },
    subtasks: [{ title: 'Research and gather sources', estimate_minutes: 90, depends_on: [] }],
  }),
}));

vi.mock('../../src/main/planner/schedule', () => ({
  scheduleTasks: vi.fn().mockResolvedValue([
    {
      taskId: 'temp-0',
      start: new Date('2026-05-24T09:30:00.000Z'),
      end: new Date('2026-05-24T11:00:00.000Z'),
    },
  ]),
}));

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
    setupIpcHandlers(getOverlayWindow);
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

  describe('goal:commit calendar sync ordering', () => {
    const scheduledPlan: ProposedPlan = {
      goal: { title: 'Synced Goal', description: 'desc', deadline: '2026-06-01' },
      subtasks: [
        {
          title: 'Scheduled subtask',
          estimate_minutes: 30,
          scheduled_start: '2026-05-24T09:30:00.000Z',
          scheduled_end: '2026-05-24T11:00:00.000Z',
        },
      ],
    };

    function getCommitHandler() {
      const calls = (ipcMain.handle as ReturnType<typeof vi.fn>).mock.calls;
      const commitCall = calls.find((call) => call[0] === 'goal:commit');
      return commitCall?.[1] as (event: unknown, plan: ProposedPlan) => Promise<{ goalId: string }>;
    }

    beforeEach(() => {
      settingsRepo.update({ googleConnected: true });
    });

    afterEach(() => {
      settingsRepo.update({ googleConnected: false });
      vi.restoreAllMocks();
    });

    it('persists the task even when calendar event creation fails (no orphaned event)', async () => {
      vi.spyOn(calendarSync, 'createEvent').mockRejectedValue(new Error('Calendar API down'));

      const result = await getCommitHandler()({}, scheduledPlan);

      const tasks = tasksRepo.listByGoal(result.goalId);
      expect(tasks).toHaveLength(1);
      expect(tasks[0]?.calendar_event_id).toBeFalsy();
    });

    it('backfills calendar_event_id after a successful calendar sync', async () => {
      vi.spyOn(calendarSync, 'createEvent').mockResolvedValue('gcal-evt-1');

      const result = await getCommitHandler()({}, scheduledPlan);

      const tasks = tasksRepo.listByGoal(result.goalId);
      expect(tasks).toHaveLength(1);
      expect(tasks[0]?.calendar_event_id).toBe('gcal-evt-1');
    });
  });

  it('handles overlay:close by hiding the window', async () => {
    const calls = (ipcMain.handle as ReturnType<typeof vi.fn>).mock.calls;
    const closeCall = calls.find((call) => call[0] === 'overlay:close');
    expect(closeCall).toBeDefined();

    const handler = closeCall?.[1] as (event: unknown) => Promise<void>;
    await handler({});
    expect(mockOverlayWindow.hide).toHaveBeenCalled();
  });

  // Skipped: the `activity:purge` IPC handler was removed alongside the Activity tab
  // in commit 9e8d534 ("Redesign overlay glassmorphism… remove Today and Activity tabs").
  // The handler no longer exists in src/main/ipc.ts, so this test has nothing to exercise.
  // Unrelated to Milestone C-8 authedFetch changes.
  it.skip('activity:purge with olderThan unlinks screenshot files before purging DB rows', async () => {
    const unlinkSpy = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(nodeFs.promises, 'unlink').mockImplementation(unlinkSpy);

    const oldTs = '2026-01-01T00:00:00.000Z';
    const recentTs = '2026-06-24T00:00:00.000Z';
    activityRepo.insert({
      kind: 'screenshot_captured',
      payload: { filePath: '/tmp/plover-screens/old.png', width: 1, height: 1 },
      ts: oldTs,
    });
    activityRepo.insert({
      kind: 'screenshot_captured',
      payload: { filePath: '/tmp/plover-screens/recent.png', width: 1, height: 1 },
      ts: recentTs,
    });

    const calls = (ipcMain.handle as ReturnType<typeof vi.fn>).mock.calls;
    const purgeCall = calls.find((call) => call[0] === 'activity:purge');
    expect(purgeCall).toBeDefined();
    const handler = purgeCall?.[1] as (event: unknown, args: { olderThan?: string; ids?: number[] }) => Promise<{ deleted: number }>;

    const olderThan = '2026-06-01T00:00:00.000Z';
    const result = await handler({}, { olderThan });

    expect(result.deleted).toBe(1);
    expect(unlinkSpy).toHaveBeenCalledWith('/tmp/plover-screens/old.png');
    expect(unlinkSpy).not.toHaveBeenCalledWith('/tmp/plover-screens/recent.png');

    vi.restoreAllMocks();
  });

  it('handles overlay:resize by setting bounds if height changed', async () => {
    const calls = (ipcMain.handle as ReturnType<typeof vi.fn>).mock.calls;
    const resizeCall = calls.find((call) => call[0] === 'overlay:resize');
    expect(resizeCall).toBeDefined();

    const handler = resizeCall?.[1] as (
      event: unknown,
      height: number,
      width?: number,
    ) => Promise<void>;

    // Height changes (window re-centers vertically)
    await handler({}, 200);
    expect(mockOverlayWindow.setBounds).toHaveBeenCalledWith({
      x: 10,
      y: -40,
      width: 600,
      height: 200,
    });

    // Height does not change
    mockOverlayWindow.setBounds.mockClear();
    await handler({}, 80);
    expect(mockOverlayWindow.setBounds).not.toHaveBeenCalled();

    // Width changes (with horizontal centering)
    mockOverlayWindow.setBounds.mockClear();
    await handler({}, 80, 440);
    expect(mockOverlayWindow.setBounds).toHaveBeenCalledWith({
      x: 90,
      y: 20,
      width: 440,
      height: 80,
    });
  });
});
