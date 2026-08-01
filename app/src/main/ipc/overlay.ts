import { ipcMain, BrowserWindow } from 'electron';
import { createCompanionWindow } from '../windows/companion.js';

export function registerOverlayHandlers(
  getOverlayWindow: () => BrowserWindow | null,
  createOverlayWindow?: (variant: 'overlay' | 'window') => BrowserWindow,
): () => BrowserWindow {
  ipcMain.handle('overlay:close', async () => {
    const overlayWin = getOverlayWindow();
    if (overlayWin) {
      overlayWin.hide();
    }
  });

  ipcMain.handle('overlay:resize', async (_event, height: number, width?: number) => {
    const overlayWin = getOverlayWindow();
    if (overlayWin) {
      const bounds = overlayWin.getBounds();
      const newWidth = width ?? bounds.width;
      if (bounds.height !== height || bounds.width !== newWidth) {
        const newX = bounds.x - Math.round((newWidth - bounds.width) / 2);
        const newY = bounds.y - Math.round((height - bounds.height) / 2);
        overlayWin.setBounds({
          x: newX,
          y: newY,
          width: newWidth,
          height: height,
        });
      }
    }
  });

  let setupWindow: BrowserWindow | null = null;

  ipcMain.handle('overlay:openWindow', async () => {
    if (setupWindow && !setupWindow.isDestroyed()) {
      setupWindow.focus();
      return;
    }
    if (createOverlayWindow) {
      setupWindow = createOverlayWindow('window');
      setupWindow.on('closed', () => {
        setupWindow = null;
      });
      setupWindow.show();
    }
  });

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
  ipcMain.handle('companion:resize', (_e, height: number, width?: number) => {
    const w = ensureCompanion();
    const bounds = w.getBounds();
    const newHeight = Math.max(56, Math.min(640, Math.round(height)));
    const newWidth = width !== undefined ? Math.round(width) : bounds.width;
    if (bounds.height !== newHeight || bounds.width !== newWidth) {
      const newX = bounds.x - Math.round((newWidth - bounds.width) / 2);
      const newY = bounds.y - Math.round((newHeight - bounds.height) / 2);
      w.setBounds({ x: newX, y: newY, width: newWidth, height: newHeight });
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

  ipcMain.handle('overlay:set-ignore-mouse-events', async (_event, ignore: boolean) => {
    const overlayWin = getOverlayWindow();
    if (overlayWin) {
      overlayWin.setIgnoreMouseEvents(ignore, { forward: true });
    }
  });

  ipcMain.handle('overlay:set-tracking', async (_event, tracking: boolean) => {
    const overlayWin = getOverlayWindow();
    if (overlayWin) {
      (overlayWin as BrowserWindow & { isTracking?: boolean }).isTracking = tracking;
    }
  });

  return ensureCompanion;
}
