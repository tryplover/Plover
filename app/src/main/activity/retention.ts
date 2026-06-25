import { promises as fs } from 'node:fs';
import { ActivityRepo } from '../store/repos/activity.js';
import { SettingsRepo } from '../store/repos/settings.js';

export async function runRetention(args: {
  activityRepo: ActivityRepo;
  settingsRepo: SettingsRepo;
  now: Date;
}): Promise<{ deleted: number; cutoff: string | null }> {
  const days = args.settingsRepo.getAll().activityRetentionDays;
  if (!days || days <= 0) return { deleted: 0, cutoff: null };
  const cutoff = new Date(args.now.getTime() - days * 86400000).toISOString();
  const screenshotsToUnlink = args.activityRepo
    .list({ kinds: ['screenshot_captured'], until: cutoff, limit: 1000 })
    .map((r) => (r.payload as { filePath?: string }).filePath)
    .filter((p): p is string => typeof p === 'string' && p.length > 0);
  const { deleted } = args.activityRepo.purge({ olderThan: cutoff });
  for (const p of screenshotsToUnlink) {
    try {
      await fs.unlink(p);
    } catch {
      /* file may already be gone — ignore */
    }
  }
  return { deleted, cutoff };
}
