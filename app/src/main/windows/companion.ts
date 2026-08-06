import { app, BrowserWindow, screen } from 'electron';
import { join } from 'node:path';

type QuittableApp = typeof app & { isQuitting?: boolean };

const COLLAPSED_HEIGHT = 56;
const COLLAPSED_WIDTH = 360;

export function createCompanionWindow(): BrowserWindow {
  const { workArea } = screen.getPrimaryDisplay();

  // Reverted the Windows `backgroundMaterial: 'acrylic'` experiment: it
  // requires `transparent: false`, which turned the window into an opaque
  // native rectangle — live testing showed it rendering as a flat solid
  // block (no real blur-through) and with wrong/oversized native window
  // sizing. Back to `transparent: true` for a real per-pixel-alpha window;
  // the surface look is entirely CSS-driven (see Collapsed.css /
  // Expanded.css): a near-opaque dark tint + crisp border, not a blur
  // effect, so it renders identically on every platform. Deliberately no
  // `vibrancy` — that's a macOS-only native blur that showed real desktop
  // content through the window, which looked inconsistent with (much
  // lighter than) the Windows fallback where vibrancy is a no-op. Per
  // explicit user feedback the two platforms should match, not each lean
  // on whatever OS effects happen to be available.
  const win = new BrowserWindow({
    width: COLLAPSED_WIDTH,
    height: COLLAPSED_HEIGHT,
    x: workArea.x + Math.round((workArea.width - COLLAPSED_WIDTH) / 2),
    y: workArea.y + 12,
    frame: false,
    transparent: true,
    // Explicit fully-transparent alpha hex, not omission: on some Windows setups,
    // omitting `backgroundColor` on a `transparent: true` window lets the native
    // win32 window class fall back to an opaque black backing surface instead of a
    // per-pixel-alpha one, which reads as a solid black rectangle instead of glass.
    backgroundColor: '#00000000',
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: false,
    webPreferences: {
      preload: join(import.meta.dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true,
    },
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    void win.loadURL(`${process.env.ELECTRON_RENDERER_URL}/companion/index.html`);
  } else {
    void win.loadFile(join(import.meta.dirname, '../renderer/companion/index.html'));
  }

  // 'screen-saver' floats above fullscreen apps and other always-on-top windows,
  // not just normal ones.
  win.setAlwaysOnTop(true, 'screen-saver');
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  // Electron's default app menu binds CmdOrCtrl+W to closing the focused
  // window, and this window can pick up focus (drag, grabber click). A real
  // close destroys it permanently — nothing recreates it visibly afterward
  // (setState/setActiveTask IPC calls recreate it via ensureCompanion() but
  // hidden). Hide instead, and only allow the real close during app quit.
  win.on('close', (event) => {
    if (!(app as QuittableApp).isQuitting) {
      event.preventDefault();
      win.hide();
    }
  });

  const recenter = (): void => {
    if (win.isDestroyed()) return;
    const { workArea: area } = screen.getPrimaryDisplay();
    const { width } = win.getBounds();
    win.setPosition(area.x + Math.round((area.width - width) / 2), area.y + 12);
  };
  screen.on('display-metrics-changed', recenter);
  screen.on('display-added', recenter);
  screen.on('display-removed', recenter);
  win.on('closed', () => {
    screen.removeListener('display-metrics-changed', recenter);
    screen.removeListener('display-added', recenter);
    screen.removeListener('display-removed', recenter);
  });

  return win;
}
