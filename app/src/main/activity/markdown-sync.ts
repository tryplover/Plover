import { promises as fs } from 'node:fs';
import { TasksRepo } from '../store/repos/tasks.js';
import { GoalsRepo } from '../store/repos/goals.js';
import { TypedEventBus } from '../bus.js';
import { FolderEventPayload } from '@shared/events.js';
import { parseChecklists } from './markdown-parser.js';

const INBOX_GOAL_TITLE = 'Inbox';

export class MarkdownSync {
  private onFileChangedHandler: ((payload: FolderEventPayload) => void) | null = null;
  private onFileAddedHandler: ((payload: FolderEventPayload) => void) | null = null;
  private inboxGoalId: string | null = null;
  private fileLocks = new Map<string, Promise<void>>();

  constructor(
    private tasksRepo: TasksRepo,
    private goalsRepo: GoalsRepo,
    private bus: TypedEventBus,
  ) {}

  start(): void {
    this.ensureInboxGoal();

    this.onFileChangedHandler = (payload: FolderEventPayload) => {
      void this.handleFileEvent(payload);
    };
    this.onFileAddedHandler = (payload: FolderEventPayload) => {
      void this.handleFileEvent(payload);
    };

    this.bus.on('folder.file_changed', this.onFileChangedHandler);
    this.bus.on('folder.file_added', this.onFileAddedHandler);
  }

  stop(): void {
    if (this.onFileChangedHandler) {
      this.bus.off('folder.file_changed', this.onFileChangedHandler);
      this.onFileChangedHandler = null;
    }
    if (this.onFileAddedHandler) {
      this.bus.off('folder.file_added', this.onFileAddedHandler);
      this.onFileAddedHandler = null;
    }
  }

  private ensureInboxGoal(): void {
    const existingGoals = this.goalsRepo.list({ status: 'active' });
    let inboxGoal = existingGoals.find((g) => g.title === INBOX_GOAL_TITLE);

    if (!inboxGoal) {
      inboxGoal = this.goalsRepo.create({
        title: INBOX_GOAL_TITLE,
        status: 'active',
      });
    }

    this.inboxGoalId = inboxGoal.id;
  }

  private handleFileEvent(payload: FolderEventPayload): Promise<void> {
    if (payload.kind !== 'md') {
      return Promise.resolve();
    }

    const previous = this.fileLocks.get(payload.path) ?? Promise.resolve();
    const next = previous.then(() => this.syncFile(payload.path));

    this.fileLocks.set(payload.path, next);
    void next.finally(() => {
      if (this.fileLocks.get(payload.path) === next) {
        this.fileLocks.delete(payload.path);
      }
    });

    return next;
  }

  private async syncFile(filePath: string): Promise<void> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const items = parseChecklists(content);

      if (!this.inboxGoalId) {
        this.ensureInboxGoal();
      }
      if (!this.inboxGoalId) {
        throw new Error('Failed to ensure Inbox goal');
      }
      const goalId = this.inboxGoalId;

      const existingTasks = this.tasksRepo.listByGoal(goalId);
      const taskMap = new Map(
        existingTasks.map((t) => [t.title.trim().toLowerCase(), t]),
      );

      for (const item of items) {
        const normalizedTitle = item.title.trim().toLowerCase();
        const matchingTask = taskMap.get(normalizedTitle);

        if (!matchingTask) {
          const newTask = this.tasksRepo.create({
            goal_id: goalId,
            title: item.title.trim(),
            estimate_minutes: 30,
            status: item.completed ? 'done' : 'todo',
            depends_on: [],
          });
          taskMap.set(normalizedTitle, newTask);
        } else if (item.completed && matchingTask.status !== 'done') {
          const updated = this.tasksRepo.update(matchingTask.id, { status: 'done' });
          taskMap.set(normalizedTitle, updated);
        } else if (!item.completed && matchingTask.status === 'done') {
          const updated = this.tasksRepo.update(matchingTask.id, { status: 'todo' });
          taskMap.set(normalizedTitle, updated);
        }
      }
    } catch (err) {
      console.error('[MarkdownSync] Error syncing file:', filePath, err);
    }
  }
}
