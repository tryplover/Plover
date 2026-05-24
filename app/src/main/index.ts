import { app, BrowserWindow } from 'electron';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { setupIpc, type IpcHandlers } from './ipc.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1024,
    height: 720,
    title: 'Tendril',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true,
    },
  });

  const devUrl = process.env['ELECTRON_RENDERER_URL'];
  if (devUrl) {
    void win.loadURL(devUrl);
  } else {
    void win.loadFile(join(__dirname, '../renderer/index.html'));
  }
}

const stubHandlers: IpcHandlers = {
  goals: {
    create: async (goal) => ({
      id: 'stub-goal-id',
      ...goal,
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }),
    get: async () => null,
    list: async () => [],
    update: async (id, patch) => ({
      id,
      title: 'Stub Goal',
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...patch,
    }),
  },
  tasks: {
    create: async (task) => ({
      id: 'stub-task-id',
      ...task,
      status: 'todo',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }),
    get: async () => null,
    listByGoal: async () => [],
    listScheduledBetween: async () => [],
    update: async (id, patch) => ({
      id,
      goal_id: 'stub-goal-id',
      title: 'Stub Task',
      estimate_minutes: 30,
      status: 'todo',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...patch,
    }),
  },
  planner: {
    decompose: async (goalText) => ({
      goal: {
        title: `Decomposed: ${goalText}`,
        description: 'Stub description',
      },
      subtasks: [
        {
          title: 'Subtask 1',
          estimate_minutes: 60,
        },
      ],
    }),
    schedule: async ({ tasks }) =>
      tasks.map((t) => ({
        taskId: t.id,
        start: new Date().toISOString(),
        end: new Date().toISOString(),
      })),
  },
  calendar: {
    connect: async () => {
      return;
    },
    disconnect: async () => {
      return;
    },
    getConnectionStatus: async () => ({ connected: false }),
  },
  settings: {
    get: async () => ({
      workingHours: { start: '09:00', end: '18:00' },
      horizonDays: 14,
      pauseScheduling: false,
    }),
    update: async () => {
      return;
    },
  },
  overlay: {
    hide: async () => {
      return;
    },
  },
};

void app.whenReady().then(() => {
  setupIpc(stubHandlers);
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
