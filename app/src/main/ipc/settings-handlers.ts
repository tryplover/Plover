import { ipcMain } from 'electron';
import { settingsRepo } from '../store/index.js';
import { GoogleAuth } from '../sync/google-auth.js';
import { eventBus } from '../bus.js';
import {
  getScreenRecordingStatus,
  requestScreenRecording,
} from '../permissions/screen-recording.js';
import { SettingsData } from '../store/repos/settings.js';
import { startSignup } from '../auth/signup-flow.js';

export function registerSettingsHandlers(
  googleAuth: GoogleAuth,
  onWatchedFoldersChange?: (folders: string[]) => Promise<void> | void,
) {
  ipcMain.handle('settings:get', async () => {
    return settingsRepo.getAll();
  });

  ipcMain.handle('settings:update', async (_: unknown, patch: Partial<SettingsData>) => {
    settingsRepo.update(patch);
    return settingsRepo.getAll();
  });

  ipcMain.handle('settings:watched-folders:get', async () => {
    const settings = settingsRepo.getAll();
    return settings.watchedFolders;
  });

  ipcMain.handle('settings:watched-folders:set', async (_, folders: string[]) => {
    settingsRepo.update({ watchedFolders: folders });
    if (onWatchedFoldersChange) {
      await onWatchedFoldersChange(folders);
    }
    return folders;
  });

  ipcMain.handle('calendar:connect', async () => {
    try {
      await googleAuth.authorize();
      settingsRepo.update({ googleConnected: true });
      eventBus.emit('calendar.synced');
      return true;
    } catch (err) {
      console.error('[OAuth] Connection failed:', err);
      return false;
    }
  });

  ipcMain.handle('calendar:disconnect', async () => {
    await googleAuth.disconnect();
    settingsRepo.update({ googleConnected: false });
  });

  ipcMain.handle('signup:start', async () => {
    await startSignup();
  });

  ipcMain.handle('permissions:screenRecording:status', () => getScreenRecordingStatus());
  ipcMain.handle('permissions:screenRecording:request', async () => requestScreenRecording());
}
