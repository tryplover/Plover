import { systemPreferences, desktopCapturer, shell } from 'electron';

export type ScreenRecordingStatus =
  'granted' | 'denied' | 'not-determined' | 'restricted' | 'unsupported';

export function getScreenRecordingStatus(): ScreenRecordingStatus {
  // Windows has no OS-level consent gate for Electron's desktopCapturer, unlike
  // macOS's TCC screen-recording permission, so capture is always available.
  if (process.platform === 'win32') return 'granted';
  if (process.platform !== 'darwin') return 'unsupported';
  return systemPreferences.getMediaAccessStatus('screen') as ScreenRecordingStatus;
}

export async function requestScreenRecording(): Promise<'granted' | 'denied' | 'unsupported'> {
  if (process.platform === 'win32') return 'granted';
  if (process.platform !== 'darwin') return 'unsupported';
  try {
    await desktopCapturer.getSources({ types: ['screen'], thumbnailSize: { width: 1, height: 1 } });
  } catch {
    /* ignore; we read status next */
  }
  const status = systemPreferences.getMediaAccessStatus('screen');
  return status === 'granted' ? 'granted' : 'denied';
}

export function openScreenRecordingSettings(): void {
  if (process.platform !== 'darwin') return;
  void shell.openExternal(
    'x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture',
  );
}
