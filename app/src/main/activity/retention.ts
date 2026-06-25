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
  const PAGE = 500;
  let offset = 0;
  const filesToUnlink: string[] = [];
  for (;;) {
    const page = args.activityRepo.list({ kinds: ['screenshot_captured'], until: cutoff, limit: PAGE, offset });
    for (const r of page) {
      if (r.ts >= cutoff) continue;
      const filePath = (r.payload as { filePath?: string }).filePath;
      if (typeof filePath === 'string' && filePath.length > 0) {
        filesToUnlink.push(filePath);
      }
    }
    if (page.length < PAGE) break;
    offset += PAGE;
  }
  const { deleted } = args.activityRepo.purge({ olderThan: cutoff });
  for (const p of filesToUnlink) {
    try {
      await fs.unlink(p);
    } catch {
      /* file may already be gone — ignore */
    }
  }
  return { deleted, cutoff };
}
