import { BrowserWindow } from 'electron';
import { startEventForwarding } from './planner/goal-manager.js';
import { GoogleAuth } from './sync/google-auth.js';
import { GoogleCalendarSync } from './sync/calendar.js';
import { registerGoalsHandlers } from './ipc/goals-handlers.js';
import { registerTasksHandlers } from './ipc/tasks-handlers.js';
import { registerSettingsHandlers } from './ipc/settings-handlers.js';
import { registerOverlayHandlers } from './ipc/overlay-handlers.js';
import { registerCompanionHandlers } from './ipc/companion-handlers.js';

export const googleAuth = new GoogleAuth();
export const calendarSync = new GoogleCalendarSync(googleAuth);

function broadcast(channel: string, payload?: unknown): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      if (payload === undefined) {
        win.webContents.send(channel);
      } else {
        win.webContents.send(channel, payload);
      }
    }
  }
}

export function setupIpcHandlers(
  getOverlayWindow: () => BrowserWindow | null,
  onWatchedFoldersChange?: (folders: string[]) => Promise<void> | void,
  createOverlayWindow?: (variant: 'overlay' | 'window') => BrowserWindow,
): void {
  void googleAuth.loadSavedCredentials();

  registerGoalsHandlers(calendarSync);
  registerTasksHandlers();
  registerSettingsHandlers(googleAuth, onWatchedFoldersChange);
  registerOverlayHandlers(getOverlayWindow, calendarSync, createOverlayWindow);
  registerCompanionHandlers();
}

export function setupIpc(
  getOverlayWindow: () => BrowserWindow | null,
  onWatchedFoldersChange?: (folders: string[]) => Promise<void> | void,
  createOverlayWindow?: (variant: 'overlay' | 'window') => BrowserWindow,
): void {
  setupIpcHandlers(getOverlayWindow, onWatchedFoldersChange, createOverlayWindow);
  startEventForwarding(broadcast);
}
