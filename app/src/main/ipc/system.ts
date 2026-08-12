import { ipcMain } from 'electron';
import { openWindows } from 'get-windows';
import {
  getScreenRecordingStatus,
  requestScreenRecording,
  openScreenRecordingSettings,
} from '../permissions/screen-recording.js';

export function registerSystemHandlers(): void {
  ipcMain.handle('permissions:screenRecording:status', () => getScreenRecordingStatus());
  ipcMain.handle('permissions:screenRecording:request', async () => requestScreenRecording());
  ipcMain.handle('permissions:screenRecording:openSettings', async () =>
    openScreenRecordingSettings(),
  );

  ipcMain.handle('window:list-active', async () => {
    if (process.platform !== 'darwin' && process.platform !== 'win32') return [];
    try {
      const results = await openWindows();
      return results
        .filter((w) => w.title.trim().length > 0)
        .map((w) => ({ app: w.owner.name, title: w.title }));
    } catch (err) {
      console.error('Failed to list open windows:', err);
      return [];
    }
  });
}
