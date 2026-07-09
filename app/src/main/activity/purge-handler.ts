import { promises as fs } from 'node:fs';
import { activityRepo } from '../store/index.js';

export async function handleActivityPurge(args: { olderThan?: string; ids?: number[] }) {
  if (args?.ids && args.ids.length > 0) {
    const orphanPaths = activityRepo
      .getByIds(args.ids.map(Number))
      .filter((r) => r.kind === 'screenshot_captured')
      .map((r) => (r.payload as { filePath?: string }).filePath)
      .filter((p): p is string => typeof p === 'string');
    const result = activityRepo.purge({ ids: args.ids });
    for (const p of orphanPaths) {
      try {
        await fs.unlink(p);
      } catch {
        /* ignore */
      }
    }
    return result;
  }
  if (args?.olderThan) {
    const olderThan = args.olderThan;
    const PAGE = 500;
    let offset = 0;
    for (;;) {
      const page = activityRepo.list({
        kinds: ['screenshot_captured'],
        until: olderThan,
        limit: PAGE,
        offset,
      });
      const screenshotPage = page.filter((r) => r.ts < olderThan);
      const filePaths = screenshotPage
        .map((r) => (r.payload as { filePath?: string }).filePath)
        .filter((p): p is string => typeof p === 'string');

      const BATCH_SIZE = 50;
      for (let i = 0; i < filePaths.length; i += BATCH_SIZE) {
        const batch = filePaths.slice(i, i + BATCH_SIZE);
        await Promise.allSettled(batch.map((p) => fs.unlink(p)));
      }
      if (page.length < PAGE) break;
      offset += PAGE;
    }
    return activityRepo.purge({ olderThan });
  }
  return { deleted: 0 };
}
