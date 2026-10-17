import { ipcMain, BrowserWindow } from 'electron';
import { goalsRepo } from '../store/index.js';
import { decomposeGoal } from '../planner/decompose.js';
import { saveGoalAndTasks, deleteGoalAndTasks } from '../planner/goal-manager.js';
import { ProposedPlan } from '../../preload/index.js';

export function registerGoalsHandlers(getOverlayWindow: () => BrowserWindow | null): void {
  ipcMain.handle('goals:get', async () => {
    return goalsRepo.list();
  });

  ipcMain.handle('goals:delete', async (_, id: string) => {
    await deleteGoalAndTasks(id);
    return true;
  });

  // Overlay API
  ipcMain.handle('goal:propose', async (_event, goalText: string): Promise<ProposedPlan> => {
    const result = await decomposeGoal({
      goalText,
      now: new Date(),
    });

    return {
      goal: result.goal,
      subtasks: result.subtasks.map((t) => ({
        title: t.title,
        estimate_minutes: t.estimate_minutes,
        depends_on: t.depends_on || [],
      })),
    };
  });

  ipcMain.handle('goal:commit', async (_event, plan: ProposedPlan): Promise<{ goalId: string }> => {
    const result = await saveGoalAndTasks(plan.goal, plan.subtasks);

    const overlayWin = getOverlayWindow();
    if (overlayWin) {
      overlayWin.hide();
    }

    return { goalId: result.goal.id };
  });
}
