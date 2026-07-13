import { ipcMain, BrowserWindow } from 'electron';
import { createCompanionWindow } from '../windows/companion.js';

export function setupCompanionHandlers(): void {
  // Companion
  let companion: BrowserWindow | null = null;
  let companionKind = 'observing';
  let companionActiveTaskId: string | null = null;

  function ensureCompanion(): BrowserWindow {
    if (!companion || companion.isDestroyed()) {
      companion = createCompanionWindow();
      companion.on('closed', () => {
        companion = null;
      });
    }
    return companion;
  }

  ipcMain.handle('companion:show', () => {
    ensureCompanion().show();
  });
  ipcMain.handle('companion:hide', () => {
    companion?.hide();
  });
  ipcMain.handle('companion:resize', (_e, height: number) => {
    const w = ensureCompanion();
    const [width] = w.getSize();
    if (width !== undefined) {
      w.setSize(width, Math.max(56, Math.min(640, Math.round(height))));
    }
  });
  ipcMain.handle('companion:setActiveTask', (_e, taskId: string | null) => {
    companionActiveTaskId = taskId;
    ensureCompanion().webContents.send('companion:activeTask', taskId);
  });
  ipcMain.handle('companion:setState', (_e, kind: string) => {
    companionKind = kind;
    ensureCompanion().webContents.send('companion:state', kind);
  });
  ipcMain.handle('companion:getInitialState', () => ({
    kind: companionKind,
    activeTaskId: companionActiveTaskId,
  }));
}
