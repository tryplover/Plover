import './load-env.js';
import { app, BrowserWindow, globalShortcut, nativeImage } from 'electron';
import { join } from 'node:path';
import { setupIpc, googleAuth } from './ipc/index.js';
import { settingsRepo } from './store/index.js';
import { GDocsPoller } from './sync/gdocs-poller.js';
import { eventBus } from './events/bus.js';
import { clearAllTimers } from './lifecycle/periodic.js';
import { initActivityMonitoring, stopActivityMonitoring } from './activity/index.js';
import { completeSignup } from './auth/signup-flow.js';

if (!app.isPackaged) {
  app.commandLine.appendSwitch('enable-logging');
}

app.setAsDefaultProtocolClient('plover');

const iconPath = join(import.meta.dirname, '../../build/icon.png');
const appIcon = nativeImage.createFromPath(iconPath);
if (!app.isPackaged && process.platform === 'darwin' && !appIcon.isEmpty()) {
  app.dock?.setIcon(appIcon);
}

const bufferedProtocolUrls: string[] = [];
let appIsReady = false;

function handleProtocolUrl(url: string): void {
  if (!url.startsWith('plover://')) return;
  if (!appIsReady) {
    bufferedProtocolUrls.push(url);
    return;
  }
  completeSignup(url);
}

app.on('open-url', (event, url) => {
  event.preventDefault();
  handleProtocolUrl(url);
});

let mainWindow: BrowserWindow | null = null;
let overlayWindow: BrowserWindow | null = null;
let gdocsPoller: GDocsPoller | null = null;
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', (_event, argv) => {
    for (const arg of argv) {
      if (arg.startsWith('plover://')) {
        handleProtocolUrl(arg);
      }
    }
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  function createMainWindow(): void {
    mainWindow = new BrowserWindow({
      width: 1024,
      height: 720,
      title: 'Plover',
      frame: process.platform !== 'win32',
      transparent: false,
      backgroundColor: '#141517',
      titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'hidden',
      titleBarOverlay:
        process.platform === 'win32'
          ? { height: 32, color: '#191a1d', symbolColor: '#f4f4f6' }
          : false,
      vibrancy: process.platform === 'darwin' ? 'under-window' : undefined,
      webPreferences: {
        preload: join(import.meta.dirname, '../preload/index.js'),
        sandbox: true,
        contextIsolation: true,
      },
    });

    mainWindow.on('closed', () => {
      mainWindow = null;
    });

    const devUrl = process.env['ELECTRON_RENDERER_URL'];
    if (devUrl) {
      mainWindow.webContents.openDevTools();
      void mainWindow.loadURL(devUrl);
    } else {
      void mainWindow.loadFile(join(import.meta.dirname, '../renderer/index.html'));
    }
  }

  function createOverlayWindow(): BrowserWindow {
    const win = new BrowserWindow({
      width: 560,
      height: 480,
      frame: false,
      transparent: true,
      alwaysOnTop: true,
      skipTaskbar: true,
      show: false,
      resizable: false,
      vibrancy: 'under-window',
      webPreferences: {
        preload: join(import.meta.dirname, '../preload/index.js'),
        sandbox: true,
        contextIsolation: true,
      },
    });

    const devUrl = process.env['ELECTRON_RENDERER_URL'];
    if (devUrl) {
      void win.loadURL(`${devUrl}?variant=overlay`);
    } else {
      void win.loadFile(join(import.meta.dirname, '../renderer/index.html'), {
        search: 'variant=overlay',
      });
    }

    win.on('blur', () => {
      win.hide();
    });

    win.on('closed', () => {
      overlayWindow = null;
    });

    return win;
  }

  function toggleOverlayWindow(): void {
    if (!overlayWindow) {
      overlayWindow = createOverlayWindow();
    }

    if (overlayWindow) {
      if (overlayWindow.isVisible()) {
        overlayWindow.hide();
      } else {
        overlayWindow.setSize(560, 480);
        overlayWindow.center();
        overlayWindow.show();
        overlayWindow.focus();
        overlayWindow.webContents.send('overlay:reset');
      }
    }
  }

  void app.whenReady().then(async () => {
    appIsReady = true;
    while (bufferedProtocolUrls.length > 0) {
      const url = bufferedProtocolUrls.shift();
      if (url) completeSignup(url);
    }

    gdocsPoller = new GDocsPoller(googleAuth, settingsRepo, eventBus);
    gdocsPoller.start();

    // Register all typed IPC handlers first
    const ensureCompanion = setupIpc(() => overlayWindow);

    // Initialize all activity monitoring subsystems (trackers, retention)
    await initActivityMonitoring();

    createMainWindow();
    overlayWindow = createOverlayWindow();
    ensureCompanion().show();

    // Option is mac-only; Alt+Shift+Space elsewhere to avoid Windows' Alt+Space system-menu conflict
    const hotkey = process.platform === 'darwin' ? 'Option+Space' : 'Alt+Shift+Space';
    const registered = globalShortcut.register(hotkey, () => {
      toggleOverlayWindow();
    });

    if (!registered) {
      console.error(`[Main] Failed to register global shortcut ${hotkey}`);
    } else {
      console.log(`[Main] Registered global shortcut ${hotkey}`);
    }

    app.on('activate', () => {
      if (mainWindow === null) createMainWindow();
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });

  app.on('before-quit', () => {
    (app as typeof app & { isQuitting?: boolean }).isQuitting = true;
    if (gdocsPoller) {
      gdocsPoller.stop();
    }
    clearAllTimers();
  });

  app.on('will-quit', () => {
    stopActivityMonitoring();
    // Always clean up shortcuts to prevent leaking hooks in the OS
    globalShortcut.unregisterAll();
  });
}
