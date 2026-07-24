import { SettingsRepo, SettingsData } from '../../store/repos/settings.js';

type BoolKeyOf<T> = {
  [K in keyof T]: T[K] extends boolean ? K : never;
}[keyof T];

export function gate(settingsRepo: SettingsRepo, featureKey: BoolKeyOf<SettingsData>): boolean {
  const s = settingsRepo.getAll();
  if (s.pauseAllTracking) return false;
  return Boolean(s[featureKey]);
}
