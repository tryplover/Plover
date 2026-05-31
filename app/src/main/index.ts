import { app, BrowserWindow, globalShortcut } from 'electron';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { setupIpc } from './ipc.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

let mainWindow: BrowserWindow | null = null;
let overlayWindow: BrowserWindow | null = null;

function createMainWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1024,
    height: 720,
    title: 'Plover',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true,
    },
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  const devUrl = process.env['ELECTRON_RENDERER_URL'];
  if (devUrl) {
    void mainWindow.loadURL(devUrl);
  } else {
    void mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }
}

function createOverlayWindow(): void {
  overlayWindow = new BrowserWindow({
    width: 600,
    height: 80,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    show: false,
    resizable: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true,
    },
  });

  const devUrl = process.env['ELECTRON_RENDERER_URL'];
  if (devUrl) {
    void overlayWindow.loadURL(`${devUrl}?overlay`);
  } else {
    void overlayWindow.loadFile(join(__dirname, '../renderer/index.html'), {
      search: 'overlay',
    });
  }

  overlayWindow.on('blur', () => {
    overlayWindow?.hide();
  });

  overlayWindow.on('closed', () => {
    overlayWindow = null;
  });
}

function toggleOverlayWindow(): void {
  if (!overlayWindow) {
    createOverlayWindow();
  }

  if (overlayWindow) {
    if (overlayWindow.isVisible()) {
      overlayWindow.hide();
    } else {
      overlayWindow.setSize(600, 80);
      overlayWindow.center();
      overlayWindow.show();
      overlayWindow.focus();
      overlayWindow.webContents.send('overlay:reset');
    }
  }
}

void app.whenReady().then(() => {
  // Register all typed IPC handlers first
  setupIpc(() => overlayWindow);

  createMainWindow();
  createOverlayWindow();

  // Register the global hotkey Option + Space
  const registered = globalShortcut.register('Option+Space', () => {
    toggleOverlayWindow();
  });

  if (!registered) {
    console.error('[Main] Failed to register global shortcut Option+Space');
  } else {
    console.log('[Main] Registered global shortcut Option+Space');
  }

  app.on('activate', () => {
    if (mainWindow === null) createMainWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('will-quit', () => {
  // Always clean up shortcuts to prevent leaking hooks in the OS
  globalShortcut.unregisterAll();
});
