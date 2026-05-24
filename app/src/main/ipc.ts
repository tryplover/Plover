import { ipcMain, BrowserWindow } from 'electron';
import { ProposedPlan } from '../preload/index';
import { Goal, Task } from '../shared/types';

// Simple in-memory store for mocked goals and tasks
const mockGoals: Goal[] = [];
const mockTasks: Task[] = [];

export function registerIpcHandlers(getOverlayWindow: () => BrowserWindow | null): void {
  // Propose goal (decomposition + scheduling)
  ipcMain.handle('goal:propose', async (_event, goalText: string): Promise<ProposedPlan> => {
    // Simulate network/Gemini delay (e.g. 500ms)
    await new Promise((resolve) => setTimeout(resolve, 600));

    const now = new Date();
    const nextWeek = new Date();
    nextWeek.setDate(now.getDate() + 7);

    // Extract deadline if mentioned (very simple regex)
    let deadline = nextWeek.toISOString().split('T')[0];
    if (goalText.toLowerCase().includes('tomorrow')) {
      const tomorrow = new Date();
      tomorrow.setDate(now.getDate() + 1);
      deadline = tomorrow.toISOString().split('T')[0];
    } else if (goalText.toLowerCase().includes('tuesday')) {
      const tuesday = new Date();
      tuesday.setDate(now.getDate() + ((9 - now.getDay()) % 7 || 7));
      deadline = tuesday.toISOString().split('T')[0];
    }

    // Generate mock subtasks based on goal content
    const subtasks: ProposedPlan['subtasks'] = [];
    const titleLower = goalText.toLowerCase();

    if (
      titleLower.includes('essay') ||
      titleLower.includes('paper') ||
      titleLower.includes('write')
    ) {
      subtasks.push(
        {
          title: 'Research and gather sources',
          estimate_minutes: 90,
          depends_on: [],
          scheduled_start: formatSlot(now, 9, 30),
          scheduled_end: formatSlot(now, 11, 0),
        },
        {
          title: 'Create outline and structure',
          estimate_minutes: 60,
          depends_on: ['Research and gather sources'],
          scheduled_start: formatSlot(now, 11, 30),
          scheduled_end: formatSlot(now, 12, 30),
        },
        {
          title: 'Draft introduction and body paragraphs',
          estimate_minutes: 180,
          depends_on: ['Create outline and structure'],
          scheduled_start: formatSlot(now, 14, 0),
          scheduled_end: formatSlot(now, 17, 0),
        },
        {
          title: 'Revise and edit draft',
          estimate_minutes: 60,
          depends_on: ['Draft introduction and body paragraphs'],
          scheduled_start: formatSlot(now, 17, 0),
          scheduled_end: formatSlot(now, 18, 0),
        },
      );
    } else if (
      titleLower.includes('code') ||
      titleLower.includes('build') ||
      titleLower.includes('implement')
    ) {
      subtasks.push(
        {
          title: 'Design architecture and interface',
          estimate_minutes: 60,
          depends_on: [],
          scheduled_start: formatSlot(now, 9, 0),
          scheduled_end: formatSlot(now, 10, 0),
        },
        {
          title: 'Write core implementation code',
          estimate_minutes: 240,
          depends_on: ['Design architecture and interface'],
          scheduled_start: formatSlot(now, 10, 15),
          scheduled_end: formatSlot(now, 14, 15),
        },
        {
          title: 'Write unit and integration tests',
          estimate_minutes: 90,
          depends_on: ['Write core implementation code'],
          scheduled_start: formatSlot(now, 14, 30),
          scheduled_end: formatSlot(now, 16, 0),
        },
        {
          title: 'Refactor and perform code review',
          estimate_minutes: 60,
          depends_on: ['Write unit and integration tests'],
          scheduled_start: formatSlot(now, 16, 15),
          scheduled_end: formatSlot(now, 17, 15),
        },
      );
    } else {
      subtasks.push(
        {
          title: 'Initial planning and scoping',
          estimate_minutes: 45,
          depends_on: [],
          scheduled_start: formatSlot(now, 10, 0),
          scheduled_end: formatSlot(now, 10, 45),
        },
        {
          title: 'Execution of main task',
          estimate_minutes: 120,
          depends_on: ['Initial planning and scoping'],
          scheduled_start: formatSlot(now, 11, 0),
          scheduled_end: formatSlot(now, 13, 0),
        },
        {
          title: 'Final review and verification',
          estimate_minutes: 45,
          depends_on: ['Execution of main task'],
          scheduled_start: formatSlot(now, 14, 0),
          scheduled_end: formatSlot(now, 14, 45),
        },
      );
    }

    return {
      goal: {
        title: goalText,
        description: `Automatically decomposed from: "${goalText}"`,
        deadline,
      },
      subtasks,
    };
  });

  // Commit goal
  ipcMain.handle('goal:commit', async (_event, plan: ProposedPlan): Promise<{ goalId: string }> => {
    // Simulate saving to DB and writing to Google Calendar
    await new Promise((resolve) => setTimeout(resolve, 500));

    const goalId = 'goal_' + Math.random().toString(36).substring(2, 11);
    const createdGoal: Goal = {
      id: goalId,
      title: plan.goal.title,
      description: plan.goal.description,
      deadline: plan.goal.deadline,
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    mockGoals.push(createdGoal);

    plan.subtasks.forEach((task) => {
      const taskId = 'task_' + Math.random().toString(36).substring(2, 11);
      const createdTask: Task = {
        id: taskId,
        goal_id: goalId,
        title: task.title,
        estimate_minutes: task.estimate_minutes,
        depends_on: task.depends_on,
        scheduled_start: task.scheduled_start,
        scheduled_end: task.scheduled_end,
        calendar_event_id: 'cal_' + Math.random().toString(36).substring(2, 11),
        status: 'scheduled',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      mockTasks.push(createdTask);
    });

    console.log(
      `[IPC] Goal committed successfully: ${plan.goal.title} (${plan.subtasks.length} tasks)`,
    );

    // Hide overlay window after commit
    const overlayWin = getOverlayWindow();
    if (overlayWin) {
      overlayWin.hide();
    }

    return { goalId };
  });

  // Close overlay
  ipcMain.handle('overlay:close', async () => {
    const overlayWin = getOverlayWindow();
    if (overlayWin) {
      overlayWin.hide();
    }
  });

  // Resize overlay
  ipcMain.handle('overlay:resize', async (_event, height: number) => {
    const overlayWin = getOverlayWindow();
    if (overlayWin) {
      const bounds = overlayWin.getBounds();
      if (bounds.height !== height) {
        overlayWin.setBounds({
          x: bounds.x,
          y: bounds.y,
          width: bounds.width,
          height: height,
        });
      }
    }
  });
}

function formatSlot(baseDate: Date, hours: number, minutes: number): string {
  const d = new Date(baseDate);
  d.setHours(hours, minutes, 0, 0);
  return d.toISOString();
}
