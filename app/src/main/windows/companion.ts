import { BrowserWindow, screen } from 'electron';
import { join } from 'node:path';

const COLLAPSED_HEIGHT = 56;
const COLLAPSED_WIDTH = 360;

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
