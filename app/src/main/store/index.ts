import { app } from 'electron';
import { join } from 'node:path';
import { initDb } from './db.js';
import { GoalsRepo } from './repos/goals.js';
import { TasksRepo } from './repos/tasks.js';
import { SettingsRepo } from './repos/settings.js';
import { SessionsRepo } from './repos/sessions.js';
import { ActivityRepo } from './repos/activity.js';

let userDataDir = '.';
try {
  userDataDir = app.getPath('userData');
} catch {
  userDataDir = '.';
}

export const db = initDb(join(userDataDir, 'tendril.db'));
export const goalsRepo = new GoalsRepo(db);
export const tasksRepo = new TasksRepo(db);
export const settingsRepo = new SettingsRepo(db);
export const sessionsRepo = new SessionsRepo(db);
export const activityRepo = new ActivityRepo(db);
