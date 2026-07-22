import { BrowserWindow, screen } from 'electron';
import { join } from 'node:path';

const COLLAPSED_HEIGHT = 56;
const COLLAPSED_WIDTH = 360;

export function createCompanionWindow(): BrowserWindow {
  const { workArea } = screen.getPrimaryDisplay();

  // Reverted the Windows `backgroundMaterial: 'acrylic'` experiment: it
  // requires `transparent: false`, which turned the window into an opaque
  // native rectangle — live testing showed it rendering as a flat solid
  // block (no real blur-through) and with wrong/oversized native window
  // sizing. Back to `transparent: true` for a real per-pixel-alpha window;
  // the "liquid glass" look is now faked entirely in CSS (see Collapsed.css
  // / Expanded.css): a light translucent tint + heavy backdrop-filter blur
  // + animated gradient "mesh" blobs painted within the page itself, which
  // is the reliable, cross-platform way to get this look rather than
  // depending on the OS actually blurring arbitrary content behind the
  // window (confirmed unreliable on this Windows setup).
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
    vibrancy: 'under-window',
    visualEffectState: 'active',
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

  return win;
}
