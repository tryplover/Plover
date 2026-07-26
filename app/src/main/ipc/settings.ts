import { ipcMain } from 'electron';
import { settingsRepo, summariesRepo } from '../store/index.js';
import { SettingsData } from '../store/repos/settings.js';

export function registerSettingsHandlers(
  onWatchedFoldersChange?: (folders: string[]) => Promise<void> | void,
): void {
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

  // Summaries
  ipcMain.handle('summaries:get', async () => {
    return summariesRepo.listAll();
  });
}
