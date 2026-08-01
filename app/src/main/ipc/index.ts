import { BrowserWindow } from 'electron';
import * as supabaseAuth from '../auth/supabase-auth.js';
import { startEventForwarding } from '../planner/goal-manager.js';
import { registerGoalsHandlers } from './goals.js';
import { registerTasksHandlers } from './tasks.js';
import { registerAuthHandlers, googleAuth } from './auth.js';
import { registerSettingsHandlers } from './settings.js';
import { registerOverlayHandlers } from './overlay.js';
import { registerSystemHandlers } from './system.js';
import { registerSummariesHandlers } from './summaries.js';
import { broadcast } from './shared.js';

export { googleAuth };

export function setupIpcHandlers(
  getOverlayWindow: () => BrowserWindow | null,
  onWatchedFoldersChange?: (folders: string[]) => Promise<void> | void,
  createOverlayWindow?: (variant: 'overlay' | 'window') => BrowserWindow,
): () => BrowserWindow {
  void googleAuth.loadSavedCredentials();
  void supabaseAuth.restoreSession().then((hasSession) => {
    if (hasSession) supabaseAuth.startAutoRefresh();
  });

  registerGoalsHandlers(getOverlayWindow);
  registerTasksHandlers();
  registerAuthHandlers();
  registerSettingsHandlers(onWatchedFoldersChange);
  const ensureCompanion = registerOverlayHandlers(getOverlayWindow, createOverlayWindow);
  registerSystemHandlers();
  registerSummariesHandlers();
  return ensureCompanion;
}

export function setupIpc(
  getOverlayWindow: () => BrowserWindow | null,
  onWatchedFoldersChange?: (folders: string[]) => Promise<void> | void,
  createOverlayWindow?: (variant: 'overlay' | 'window') => BrowserWindow,
): () => BrowserWindow {
  const ensureCompanion = setupIpcHandlers(getOverlayWindow, onWatchedFoldersChange, createOverlayWindow);
  startEventForwarding(broadcast);
  return ensureCompanion;
}
