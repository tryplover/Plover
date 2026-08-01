import type { ActivityRepo } from '../../store/repos/activity.js';
import type { SettingsRepo } from '../../store/repos/settings.js';
import type { NativeImage } from 'electron';

export const VISION_UPLOAD_MAX_WIDTH = 1024;

export interface ScreenCapturerDeps {
  activityRepo: ActivityRepo;
  settingsRepo: SettingsRepo;
  userDataDir: string;
  now?: () => Date;
}

export interface GrabbedScreen {
  png: Buffer;
  size: { width: number; height: number };
  thumbnail: NativeImage;
}
