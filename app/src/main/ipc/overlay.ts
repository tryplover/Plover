import { ipcMain, BrowserWindow } from 'electron';
import { createCompanionWindow } from '../windows/companion.js';

export function registerOverlayHandlers(
  getOverlayWindow: () => BrowserWindow | null,
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

  // Companion
  let companion: BrowserWindow | null = null;
  let companionKind = 'observing';
  const companionActiveTaskId: string | null = null;

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
      // Recenter horizontally, but never recompute y from the height delta —
      // the pill's width animates over ~220ms, so the ResizeObserver in
      // Companion.tsx fires many times per expand/collapse, each computing a
      // delta off the previous call's bounds. Symmetric vertical recentering
      // accumulated rounding error across those calls, drifting the top edge
      // away from where the user last placed it instead of returning to it.
      // Anchoring y keeps the top edge fixed and grows/shrinks downward only.
      const newX = bounds.x - Math.round((newWidth - bounds.width) / 2);
      w.setBounds({ x: newX, y: bounds.y, width: newWidth, height: newHeight });
    }
  });
  ipcMain.handle('companion:setState', (_e, kind: string) => {
    companionKind = kind;
    ensureCompanion().webContents.send('companion:state', kind);
  });
  ipcMain.handle('companion:getInitialState', () => ({
    kind: companionKind,
    activeTaskId: companionActiveTaskId,
  }));

  return ensureCompanion;
}
