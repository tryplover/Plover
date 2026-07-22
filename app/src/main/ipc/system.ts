import { ipcMain, BrowserWindow } from 'electron';
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

  ipcMain.handle('window:minimize', (_event) => {
    BrowserWindow.fromWebContents(_event.sender)?.minimize();
  });
  ipcMain.handle('window:maximize', (_event) => {
    const win = BrowserWindow.fromWebContents(_event.sender);
    if (win?.isMaximized()) {
      win.unmaximize();
    } else {
      win?.maximize();
    }
  });
  ipcMain.handle('window:close', (_event) => {
    BrowserWindow.fromWebContents(_event.sender)?.close();
  });
}
