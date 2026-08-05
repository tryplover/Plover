import { app } from 'electron';
import { join } from 'node:path';
import { initDb } from './db.js';
import { GoalsRepo } from './repos/goals.js';
import { TasksRepo } from './repos/tasks.js';
import { SettingsRepo } from './repos/settings.js';
import { SessionsRepo } from './repos/sessions.js';
import { ActivityRepo } from './repos/activity.js';
import { SummariesRepo } from './repos/summaries.js';
import { SyncCursorsRepo } from './repos/sync-cursors.js';

let userDataDir = '.';
try {
  userDataDir = app.getPath('userData');
} catch {
  userDataDir = '.';
}

const dbPath = process.env.VITEST ? ':memory:' : join(userDataDir, 'plover.db');
export const db = initDb(dbPath);
export const goalsRepo = new GoalsRepo(db);
export const tasksRepo = new TasksRepo(db);
export const settingsRepo = new SettingsRepo(db);
export const sessionsRepo = new SessionsRepo(db);
export const activityRepo = new ActivityRepo(db);
export const summariesRepo = new SummariesRepo(db);
export const syncCursors = new SyncCursorsRepo(db);
