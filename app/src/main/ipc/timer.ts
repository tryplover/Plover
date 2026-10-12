import { ipcMain } from 'electron';
import { eventBus } from '../events/bus.js';
import { sessionsRepo, settingsRepo } from '../store/index.js';
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
  });

  eventBus.on('timer.changed', (snapshot) => broadcast('timer:changed', snapshot));
  eventBus.on('timer.work-block-completed', (payload) =>
    broadcast('timer:workBlockCompleted', payload),
  );

  ipcMain.handle('timer:start', async (_, taskId: string | null) => service.start(taskId));
  ipcMain.handle('timer:pause', async () => service.pause());
  ipcMain.handle('timer:resume', async () => service.resume());
  ipcMain.handle('timer:skip', async () => service.skip());
  ipcMain.handle('timer:stop', async () => service.stop());
  ipcMain.handle('timer:getSnapshot', async () => service.snapshot());
}
