import { ipcMain } from 'electron';
import { tasksRepo, summariesRepo } from '../store/index.js';
import { eventBus } from '../events/bus.js';
import { undoSummary, reassignSummary } from '../store/correction.js';

export function registerSummariesHandlers(): void {
  ipcMain.handle('summaries:undo', async (_, summaryId: number) => {
    return undoSummary(tasksRepo, summariesRepo, eventBus, summaryId);
  });

  ipcMain.handle('summaries:reassign', async (_, summaryId: number, newTaskId: string) => {
    return reassignSummary(tasksRepo, summariesRepo, eventBus, summaryId, newTaskId);
  });
}
