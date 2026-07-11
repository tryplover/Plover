import { BrowserWindow, screen, ipcMain } from 'electron';
import { join } from 'node:path';

const COLLAPSED_HEIGHT = 56;
const COLLAPSED_WIDTH = 360;

let companion: BrowserWindow | null = null;
let companionKind = 'observing';
let companionActiveTaskId: string | null = null;

export function createCompanionWindow(): BrowserWindow {
  const { workArea } = screen.getPrimaryDisplay();
  const win = new BrowserWindow({
    width: COLLAPSED_WIDTH,
    height: COLLAPSED_HEIGHT,
    x: workArea.x + workArea.width - COLLAPSED_WIDTH - 24,
    y: workArea.y + 24,
    frame: false,
    transparent: true,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: false,
    vibrancy: 'under-window',
    visualEffectState: 'active',
    webPreferences: {
      preload: join(import.meta.dirname, '../preload/index.cjs'),
      sandbox: true,
      contextIsolation: true,
    },
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    void win.loadURL(`${process.env.ELECTRON_RENDERER_URL}/companion.html`);
  } else {
    void win.loadFile(join(import.meta.dirname, '../renderer/companion/index.html'));
  }
  return win;
}

function ensureCompanion(): BrowserWindow {
  if (!companion || companion.isDestroyed()) {
    companion = createCompanionWindow();
    companion.on('closed', () => {
      companion = null;
    });
  }
  return companion;
}

export function setupCompanionIpc(): void {
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
