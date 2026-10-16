import { ipcMain } from 'electron';
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
}
