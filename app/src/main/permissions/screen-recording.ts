import { systemPreferences, desktopCapturer } from 'electron';

export type ScreenRecordingStatus =
  | 'granted'
  | 'denied'
  | 'not-determined'
  | 'restricted'
  | 'unsupported';

export function getScreenRecordingStatus(): ScreenRecordingStatus {
  if (process.platform !== 'darwin') return 'unsupported';
  return systemPreferences.getMediaAccessStatus('screen') as ScreenRecordingStatus;
}

export async function requestScreenRecording(): Promise<'granted' | 'denied' | 'unsupported'> {
  if (process.platform !== 'darwin') return 'unsupported';
  try {
    await desktopCapturer.getSources({ types: ['screen'], thumbnailSize: { width: 1, height: 1 } });
  } catch {
    /* ignore; we read status next */
  }
  const status = systemPreferences.getMediaAccessStatus('screen');
  return status === 'granted' ? 'granted' : 'denied';
}
