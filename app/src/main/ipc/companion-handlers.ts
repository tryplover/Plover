import { ipcMain, BrowserWindow } from 'electron';

export function registerCompanionHandlers(
  ensureCompanion: () => BrowserWindow,
  getCompanion: () => BrowserWindow | null,
  getState: () => { kind: string; activeTaskId: string | null },
  updateActiveTask: (taskId: string | null) => void,
  updateState: (kind: string) => void,
): void {
  ipcMain.handle('companion:show', () => {
    ensureCompanion().show();
  });

  ipcMain.handle('companion:hide', () => {
    const companion = getCompanion();
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
    updateActiveTask(taskId);
    ensureCompanion().webContents.send('companion:activeTask', taskId);
  });

  ipcMain.handle('companion:setState', (_e, kind: string) => {
    updateState(kind);
    ensureCompanion().webContents.send('companion:state', kind);
  });

  ipcMain.handle('companion:getInitialState', () => getState());
}
