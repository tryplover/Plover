import { ipcMain } from 'electron';
import { eventBus } from '../events/bus.js';
import { sessionsRepo, settingsRepo, tasksRepo } from '../store/index.js';
import { TimerService } from '../timer/service.js';
import { broadcast } from './shared.js';

export function registerTimerHandlers(): void {
  const service = new TimerService({
    getConfig: () => {
      const s = settingsRepo.getAll();
      return {
        workMinutes: s.workMinutes,
        shortBreakMinutes: s.shortBreakMinutes,
        longBreakMinutes: s.longBreakMinutes,
        blocksPerLongBreak: s.blocksPerLongBreak,
      };
    },
    sessions: sessionsRepo,
    bus: eventBus,
    now: Date.now,
    taskExists: (id) => tasksRepo.get(id) !== null,
  });

  const safeBroadcast = (channel: string, payload: unknown): void => {
    try {
      broadcast(channel, payload);
    } catch (err) {
      console.error(`[timer] failed to broadcast ${channel}`, err);
    }
  };

  eventBus.on('timer.changed', (snapshot) => safeBroadcast('timer:changed', snapshot));
  eventBus.on('timer.work-block-completed', (payload) =>
    safeBroadcast('timer:workBlockCompleted', payload),
  );

  ipcMain.handle('timer:start', async (_, taskId: string | null) => service.start(taskId));
  ipcMain.handle('timer:pause', async () => service.pause());
  ipcMain.handle('timer:resume', async () => service.resume());
  ipcMain.handle('timer:skip', async () => service.skip());
  ipcMain.handle('timer:stop', async () => service.stop());
  ipcMain.handle('timer:getSnapshot', async () => service.snapshot());
}
