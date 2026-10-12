import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const handlers = vi.hoisted(() => new Map<string, (...args: unknown[]) => unknown>());
const send = vi.hoisted(() => vi.fn());

vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn((channel: string, fn: (...args: unknown[]) => unknown) => {
      handlers.set(channel, fn);
    }),
  },
  BrowserWindow: {
    getAllWindows: vi.fn(() => [{ isDestroyed: () => false, webContents: { send } }]),
  },
}));

import { registerTimerHandlers } from '@main/ipc/timer.js';
import { eventBus } from '@main/events/bus.js';

const call = (channel: string, ...args: unknown[]) => {
  const handler = handlers.get(channel);
  if (!handler) throw new Error(`no handler registered for ${channel}`);
  return handler({}, ...args);
};

describe('timer IPC', () => {
  beforeEach(() => {
    handlers.clear();
    send.mockClear();
    eventBus.removeAllListeners();
    registerTimerHandlers();
  });

  afterEach(async () => {
    await call('timer:stop');
  });

  it('registers the six timer channels', () => {
    expect([...handlers.keys()].sort()).toEqual([
      'timer:getSnapshot',
      'timer:pause',
      'timer:resume',
      'timer:skip',
      'timer:start',
      'timer:stop',
    ]);
  });

  it('start returns a work snapshot and pushes timer:changed to windows', async () => {
    const snapshot = await call('timer:start', null);
    expect(snapshot).toMatchObject({ phase: 'work', paused: false, remainingSeconds: 1500 });
    expect(send).toHaveBeenCalledWith('timer:changed', expect.objectContaining({ phase: 'work' }));
  });

  it('getSnapshot, pause, resume and skip reflect the running timer', async () => {
    await call('timer:start', null);
    expect(await call('timer:getSnapshot')).toMatchObject({ phase: 'work' });
    expect(await call('timer:pause')).toMatchObject({ paused: true });
    expect(await call('timer:resume')).toMatchObject({ paused: false });
    expect(await call('timer:skip')).toMatchObject({ phase: 'shortBreak' });
  });

  it('stop returns an idle snapshot', async () => {
    await call('timer:start', null);
    expect(await call('timer:stop')).toMatchObject({ phase: 'idle', remainingSeconds: 0 });
  });

  it('pause while idle is a harmless no-op', async () => {
    expect(await call('timer:pause')).toMatchObject({ phase: 'idle', paused: false });
  });
});
