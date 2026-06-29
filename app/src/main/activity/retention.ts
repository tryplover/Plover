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
  let deleted = 0;
  // Batch through expired screenshots so files are always unlinked before their
  // db rows vanish, even when there are more than 1000 to clean up.
  while (true) {
    const screenshots = args.activityRepo.list({
      kinds: ['screenshot_captured'],
      until: cutoff,
      limit: 1000,
    });
    if (screenshots.length === 0) break;
    const ids = screenshots.map((r) => r.id);
    const paths = screenshots
      .map((r) => (r.payload as { filePath?: string }).filePath)
      .filter((p): p is string => typeof p === 'string' && p.length > 0);
    const { deleted: batchDeleted } = args.activityRepo.purge({ ids });
    deleted += batchDeleted;
    for (const p of paths) {
      try {
        await fs.unlink(p);
      } catch {
        /* file may already be gone — ignore */
      }
    }
  }
  const { deleted: otherDeleted } = args.activityRepo.purge({ olderThan: cutoff });
  deleted += otherDeleted;
  return { deleted, cutoff };
}
