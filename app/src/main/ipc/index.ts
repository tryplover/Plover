import { BrowserWindow } from 'electron';
import * as supabaseAuth from '../auth/supabase-auth.js';
import { startEventForwarding } from '../planner/goal-manager.js';
import { registerGoalsHandlers } from './goals.js';
import { registerTasksHandlers } from './tasks.js';
import { registerAuthHandlers, googleAuth, githubAuth } from './auth.js';
import { registerSettingsHandlers } from './settings.js';
import { registerOverlayHandlers } from './overlay.js';
import { registerSystemHandlers } from './system.js';
import { registerSummariesHandlers } from './summaries.js';
import { broadcast } from './shared.js';

export { googleAuth, githubAuth };

export function setupIpcHandlers(
  getOverlayWindow: () => BrowserWindow | null,
): () => BrowserWindow {
  void googleAuth.loadSavedCredentials();
  void githubAuth.loadSavedCredentials();
  void supabaseAuth.restoreSession().then((hasSession) => {
    if (hasSession) supabaseAuth.startAutoRefresh();
  });

  registerGoalsHandlers(getOverlayWindow);
  registerTasksHandlers();
  registerAuthHandlers();
  registerSettingsHandlers();
  const ensureCompanion = registerOverlayHandlers(getOverlayWindow);
  registerSystemHandlers();
  registerSummariesHandlers();
  return ensureCompanion;
}

export function setupIpc(
  getOverlayWindow: () => BrowserWindow | null,
): () => BrowserWindow {
  const ensureCompanion = setupIpcHandlers(getOverlayWindow);
  startEventForwarding(broadcast);
  return ensureCompanion;
}
