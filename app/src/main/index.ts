import './load-env.js';
import { app, BrowserWindow, globalShortcut } from 'electron';
import { join } from 'node:path';
import { setupIpc } from './ipc.js';
import { activityRepo, settingsRepo, tasksRepo } from './store/index.js';
import { FolderWatcher } from './activity/folder-watcher.js';
import { DeviationDetector } from './planner/deviation-detector.js';
import { calendarSync } from './ipc.js';
import { eventBus } from './bus.js';
import { clearAllTimers, schedulePeriodic } from './lifecycle/periodic.js';

if (!app.isPackaged) {
  app.commandLine.appendSwitch('enable-logging');
}

let mainWindow: BrowserWindow | null = null;
let overlayWindow: BrowserWindow | null = null;
let folderWatcher: FolderWatcher | null = null;
let deviationLoopDispose: (() => void) | null = null;

function createMainWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1024,
    height: 720,
    title: 'Plover',
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
      preload: join(import.meta.dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true,
    },
  });

  const devUrl = process.env['ELECTRON_RENDERER_URL'];
  if (devUrl) {
    void overlayWindow.loadURL(`${devUrl}?overlay`);
  } else {
    void overlayWindow.loadFile(join(import.meta.dirname, '../renderer/index.html'), {
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
  folderWatcher = new FolderWatcher(activityRepo, eventBus);
  const settings = settingsRepo.getAll();
  if (settings.watchedFolders.length > 0) {
    void folderWatcher.watch(settings.watchedFolders);
  }

  const deviationDetector = new DeviationDetector(
    tasksRepo,
    activityRepo,
    settingsRepo,
    calendarSync,
  );
  deviationLoopDispose = schedulePeriodic('deviation', 15 * 60_000, () =>
    deviationDetector.runDeviationPass(),
  );

  // Register all typed IPC handlers first
  setupIpc(() => overlayWindow, (folders: string[]) => {
    if (folderWatcher) {
      folderWatcher.watch(folders);
    }
  });

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

app.on('before-quit', () => {
  if (folderWatcher) {
    void folderWatcher.closeAllWatchers();
  }
  if (deviationLoopDispose) {
    deviationLoopDispose();
    deviationLoopDispose = null;
  }
  clearAllTimers();
});

app.on('will-quit', () => {
  // Always clean up shortcuts to prevent leaking hooks in the OS
  globalShortcut.unregisterAll();
});
