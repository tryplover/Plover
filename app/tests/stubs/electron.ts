// Vitest runs in plain Node, where the real `electron` module is not the API at
// all — it resolves to the path of a binary that npm downloads from GitHub's
// release CDN at install time, and `electron/index.js` throws
// "Electron failed to install correctly" on import when that download failed.
// That turned a CDN outage into three suites failing at collection with no test
// run and no assertion to point at.
//
// Nothing needs to be faithful here: importing modules only ever destructured
// `undefined` off the real module anyway. Tests that actually exercise Electron
// APIs replace this wholesale with vi.mock('electron', () => ({ ... })).

const noop = (): undefined => undefined;

export const app = { isPackaged: false, on: noop, whenReady: () => Promise.resolve(), quit: noop };
export const ipcMain = { handle: noop, on: noop, removeHandler: noop };
export const ipcRenderer = { invoke: () => Promise.resolve(), on: noop, send: noop };
export const contextBridge = { exposeInMainWorld: noop };
export const shell = { openExternal: () => Promise.resolve() };
export const safeStorage = { isEncryptionAvailable: () => false };
export const globalShortcut = { register: noop, unregisterAll: noop };
export const screen = {
  getPrimaryDisplay: () => ({ workArea: { x: 0, y: 0, width: 0, height: 0 } }),
};
export const desktopCapturer = { getSources: () => Promise.resolve([]) };
export const systemPreferences = { getMediaAccessStatus: () => 'not-determined' };
export const nativeImage = { createFromBuffer: noop, createEmpty: noop };

export class BrowserWindow {
  static getAllWindows = (): BrowserWindow[] => [];
  static fromWebContents = (): BrowserWindow | null => null;

  webContents = { send: noop, on: noop };
  on = noop;
  once = noop;
  show = noop;
  close = noop;
  destroy = noop;
  isDestroyed = (): boolean => false;
  loadURL = (): Promise<void> => Promise.resolve();
  loadFile = (): Promise<void> => Promise.resolve();
  setBounds = noop;
  getBounds = (): { x: number; y: number; width: number; height: number } => ({
    x: 0,
    y: 0,
    width: 0,
    height: 0,
  });
}

export class Notification {
  static isSupported = (): boolean => false;
  show = noop;
}

export type NativeImage = unknown;
