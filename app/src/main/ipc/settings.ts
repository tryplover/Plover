import { ipcMain } from 'electron';
import { settingsRepo, summariesRepo } from '../store/index.js';
import { SettingsData } from '../store/repos/settings.js';

export function registerSettingsHandlers(): void {
  ipcMain.handle('settings:get', async () => {
    return settingsRepo.getAll();
  });

  ipcMain.handle('settings:update', async (_: unknown, patch: Partial<SettingsData>) => {
    settingsRepo.update(patch);
    return settingsRepo.getAll();
  });

  // Summaries
  ipcMain.handle('summaries:get', async () => {
    return summariesRepo.listAll();
  });
}
