import { app } from 'electron';
import { join } from 'node:path';
import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { Goal, Task } from '../../shared/types';

interface StoreData {
  goals: Goal[];
  tasks: Task[];
  settings: {
    googleConnected: boolean;
    workingHours: { start: string; end: string };
    horizonDays: number;
    pauseScheduling: boolean;
  };
}

const DEFAULT_SETTINGS = {
  googleConnected: false,
  workingHours: { start: '09:00', end: '18:00' },
  horizonDays: 14,
  pauseScheduling: false,
};

export class FileStore {
  private filePath: string;
  private data: StoreData;

  constructor() {
    let userDataDir = '.';
    try {
      userDataDir = app.getPath('userData');
    } catch {
      userDataDir = '.';
    }
    this.filePath = join(userDataDir, 'tendril-store.json');
    this.data = this.load();
  }

  private load(): StoreData {
    if (existsSync(this.filePath)) {
      try {
        const content = readFileSync(this.filePath, 'utf-8');
        const parsed = JSON.parse(content);
        return {
          goals: parsed.goals || [],
          tasks: parsed.tasks || [],
          settings: { ...DEFAULT_SETTINGS, ...(parsed.settings || {}) },
        };
      } catch {
        // Fallback if parsing fails
      }
    }
    return { goals: [], tasks: [], settings: { ...DEFAULT_SETTINGS } };
  }

  private save(): void {
    writeFileSync(this.filePath, JSON.stringify(this.data, null, 2), 'utf-8');
  }

  getGoals(): Goal[] {
    return this.data.goals;
  }

  getTasks(): Task[] {
    return this.data.tasks;
  }

  addGoal(goal: Goal): void {
    this.data.goals.push(goal);
    this.save();
  }

  addTasks(tasks: Task[]): void {
    this.data.tasks.push(...tasks);
    this.save();
  }

  updateTaskStatus(id: string, status: Task['status']): Task {
    const task = this.data.tasks.find((t) => t.id === id);
    if (!task) throw new Error(`Task ${id} not found`);
    task.status = status;
    task.updated_at = new Date().toISOString();
    this.save();
    return task;
  }

  getSettings() {
    return this.data.settings;
  }

  updateSettings(settings: Partial<StoreData['settings']>) {
    this.data.settings = { ...this.data.settings, ...settings };
    this.save();
  }
}
