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

  private async handleFileEvent(payload: FolderEventPayload): Promise<void> {
    if (payload.kind !== 'md') {
      return;
    }

    try {
      const content = await fs.readFile(payload.path, 'utf-8');
      const items = parseChecklists(content);

      if (!this.inboxGoalId) {
        this.ensureInboxGoal();
      }

      if (!this.inboxGoalId) {
        throw new Error('Failed to ensure Inbox goal');
      }

      for (const item of items) {
        const normalizedTitle = item.title.trim().toLowerCase();

        const existingTasks = this.tasksRepo.listByGoal(this.inboxGoalId);
        const matchingTask = existingTasks.find(
          (t) => t.title.trim().toLowerCase() === normalizedTitle,
        );

        if (!matchingTask) {
          this.tasksRepo.create({
            goal_id: this.inboxGoalId,
            title: item.title.trim(),
            estimate_minutes: 30,
            status: item.completed ? 'done' : 'todo',
            depends_on: [],
          });
        } else {
          const fileMarksDone = item.completed;
          const dbMarksDone = matchingTask.status === 'done';

          if (fileMarksDone && !dbMarksDone) {
            this.tasksRepo.update(matchingTask.id, { status: 'done' });
          } else if (!fileMarksDone && dbMarksDone) {
            this.tasksRepo.update(matchingTask.id, { status: 'todo' });
          }
        }
      }
    } catch (err) {
      console.error('[MarkdownSync] Error handling file event:', payload.path, err);
    }
  }
}
