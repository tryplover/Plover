import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { setupIpcHandlers } from '../../src/main/ipc';
import { goalsRepo, tasksRepo, settingsRepo, activityRepo } from '../../src/main/store';
import { ipcMain } from 'electron';
import { ProposedPlan } from '../../src/preload/index';
import { BrowserWindow } from 'electron';
import * as nodeFs from 'node:fs';

const { mockSupabaseAuth } = vi.hoisted(() => {
  return {
    mockSupabaseAuth: {
      signIn: vi.fn(),
      signInWithPassword: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn(),
      restoreSession: vi.fn(),
      startAutoRefresh: vi.fn(),
      getCurrentUser: vi.fn(),
    },
  };
});

vi.mock('../../src/main/auth/supabase-auth.js', () => mockSupabaseAuth);

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
    BrowserWindow: Object.assign(vi.fn(), {
      getAllWindows: vi.fn().mockReturnValue([]),
    }),
    app: { isPackaged: false },
  };
});

vi.mock('keytar', () => ({
  default: {
    getPassword: vi.fn().mockResolvedValue(null),
    setPassword: vi.fn().mockResolvedValue(undefined),
    deletePassword: vi.fn().mockResolvedValue(true),
  },
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
    mockSupabaseAuth.restoreSession.mockResolvedValue(false);
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
    const handler = purgeCall?.[1] as (
      event: unknown,
      args: { olderThan?: string; ids?: number[] },
    ) => Promise<{ deleted: number }>;

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

  it('handles goals:delete by deleting the goal and its tasks', async () => {
    const calls = (ipcMain.handle as ReturnType<typeof vi.fn>).mock.calls;
    const deleteCall = calls.find((call) => call[0] === 'goals:delete');
    expect(deleteCall).toBeDefined();

    const handler = deleteCall?.[1] as (event: unknown, id: string) => Promise<boolean>;

    // Create a goal and a task
    const goal = goalsRepo.create({ title: 'Delete goal test', status: 'active' });
    tasksRepo.create({
      goal_id: goal.id,
      title: 'Delete task test',
      estimate_minutes: 10,
      status: 'todo',
    });

    expect(goalsRepo.get(goal.id)).not.toBeNull();
    expect(tasksRepo.listByGoal(goal.id)).toHaveLength(1);

    const result = await handler({}, goal.id);
    expect(result).toBe(true);

    expect(goalsRepo.get(goal.id)).toBeNull();
    expect(tasksRepo.listByGoal(goal.id)).toHaveLength(0);
  });

  describe('auth:signIn, auth:signOut, auth:getStatus', () => {
    function getHandler(channel: string) {
      const calls = (ipcMain.handle as ReturnType<typeof vi.fn>).mock.calls;
      const call = calls.find((c) => c[0] === channel);
      expect(call).toBeDefined();
      return call?.[1] as (event: unknown, ...args: unknown[]) => Promise<unknown>;
    }

    afterEach(() => {
      settingsRepo.update({ supabaseUserId: null, supabaseUserEmail: null });
    });

    it('calls restoreSession on setup and starts auto refresh if a session exists', async () => {
      mockSupabaseAuth.restoreSession.mockResolvedValue(true);
      setupIpcHandlers(getOverlayWindow);
      // restoreSession's .then() runs on the microtask queue
      await Promise.resolve();
      await Promise.resolve();
      expect(mockSupabaseAuth.startAutoRefresh).toHaveBeenCalled();
    });

    it('auth:signIn signs in, persists the user, and returns signed-in status', async () => {
      mockSupabaseAuth.signIn.mockResolvedValue(undefined);
      mockSupabaseAuth.getCurrentUser.mockResolvedValue({
        id: 'user-1',
        email: 'jordan@example.com',
      });

      const result = await getHandler('auth:signIn')({});

      expect(result).toEqual({ signedIn: true, email: 'jordan@example.com' });
      expect(settingsRepo.getAll().supabaseUserId).toBe('user-1');
      expect(settingsRepo.getAll().supabaseUserEmail).toBe('jordan@example.com');
    });

    it('auth:signIn throws when no user is returned', async () => {
      mockSupabaseAuth.signIn.mockResolvedValue(undefined);
      mockSupabaseAuth.getCurrentUser.mockResolvedValue(null);

      await expect(getHandler('auth:signIn')({})).rejects.toThrow();
    });

    it('auth:signInWithPassword signs in, persists the user, and returns signed-in status', async () => {
      mockSupabaseAuth.signInWithPassword.mockResolvedValue(undefined);
      mockSupabaseAuth.getCurrentUser.mockResolvedValue({
        id: 'user-1',
        email: 'jordan@example.com',
      });

      const result = await getHandler('auth:signInWithPassword')(
        {},
        'jordan@example.com',
        'hunter2!',
      );

      expect(mockSupabaseAuth.signInWithPassword).toHaveBeenCalledWith(
        'jordan@example.com',
        'hunter2!',
      );
      expect(result).toEqual({ signedIn: true, email: 'jordan@example.com' });
      expect(settingsRepo.getAll().supabaseUserId).toBe('user-1');
      expect(settingsRepo.getAll().supabaseUserEmail).toBe('jordan@example.com');
    });

    it('auth:signInWithPassword throws when no user is returned', async () => {
      mockSupabaseAuth.signInWithPassword.mockResolvedValue(undefined);
      mockSupabaseAuth.getCurrentUser.mockResolvedValue(null);

      await expect(
        getHandler('auth:signInWithPassword')({}, 'jordan@example.com', 'hunter2!'),
      ).rejects.toThrow();
    });

    it('auth:signUp signs up, persists the user, and returns signed-in status when no confirmation is needed', async () => {
      mockSupabaseAuth.signUp.mockResolvedValue({ needsEmailConfirmation: false });
      mockSupabaseAuth.getCurrentUser.mockResolvedValue({
        id: 'user-3',
        email: 'sam@example.com',
      });

      const result = await getHandler('auth:signUp')({}, 'sam@example.com', 'hunter2!');

      expect(result).toEqual({
        signedIn: true,
        email: 'sam@example.com',
        needsEmailConfirmation: false,
      });
      expect(settingsRepo.getAll().supabaseUserId).toBe('user-3');
      expect(settingsRepo.getAll().supabaseUserEmail).toBe('sam@example.com');
    });

    it('auth:signUp returns needsEmailConfirmation without persisting a user when confirmation is required', async () => {
      mockSupabaseAuth.signUp.mockResolvedValue({ needsEmailConfirmation: true });

      const result = await getHandler('auth:signUp')({}, 'sam@example.com', 'hunter2!');

      expect(result).toEqual({
        signedIn: false,
        email: 'sam@example.com',
        needsEmailConfirmation: true,
      });
      expect(mockSupabaseAuth.getCurrentUser).not.toHaveBeenCalled();
      expect(settingsRepo.getAll().supabaseUserId).toBeNull();
    });

    it('auth:signUp throws when no user is returned and confirmation was not required', async () => {
      mockSupabaseAuth.signUp.mockResolvedValue({ needsEmailConfirmation: false });
      mockSupabaseAuth.getCurrentUser.mockResolvedValue(null);

      await expect(getHandler('auth:signUp')({}, 'sam@example.com', 'hunter2!')).rejects.toThrow();
    });

    it('auth:signOut clears the persisted user and returns signed-out status', async () => {
      settingsRepo.update({ supabaseUserId: 'user-1', supabaseUserEmail: 'jordan@example.com' });
      mockSupabaseAuth.signOut.mockResolvedValue(undefined);

      const result = await getHandler('auth:signOut')({});

      expect(result).toEqual({ signedIn: false, email: null });
      expect(settingsRepo.getAll().supabaseUserId).toBeNull();
      expect(settingsRepo.getAll().supabaseUserEmail).toBeNull();
    });

    it('auth:signOut clears the local session even when the remote Supabase call fails', async () => {
      settingsRepo.update({ supabaseUserId: 'user-1', supabaseUserEmail: 'jordan@example.com' });
      mockSupabaseAuth.signOut.mockRejectedValue(new Error('network unreachable'));

      const result = await getHandler('auth:signOut')({});

      expect(result).toEqual({ signedIn: false, email: null });
      expect(settingsRepo.getAll().supabaseUserId).toBeNull();
      expect(settingsRepo.getAll().supabaseUserEmail).toBeNull();
    });

    it('auth:getStatus reflects persisted settings', async () => {
      settingsRepo.update({ supabaseUserId: 'user-2', supabaseUserEmail: 'sam@example.com' });

      const result = await getHandler('auth:getStatus')({});

      expect(result).toEqual({ signedIn: true, email: 'sam@example.com' });
    });

    it('auth:getStatus reports signed-out when nothing is persisted', async () => {
      const result = await getHandler('auth:getStatus')({});

      expect(result).toEqual({ signedIn: false, email: null });
    });
  });
});
