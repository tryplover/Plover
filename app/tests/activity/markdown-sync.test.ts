import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'node:fs';
import { mkdtemp, rmdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { runMigrations } from '@main/store/db.js';
import { TasksRepo } from '@main/store/repos/tasks.js';
import { GoalsRepo } from '@main/store/repos/goals.js';
import { TypedEventBus } from '@main/bus.js';
import { MarkdownSync } from '@main/activity/markdown-sync.js';
import { FolderEventPayload } from '@shared/events.js';

describe('MarkdownSync', () => {
  let db: Database.Database;
  let tasksRepo: TasksRepo;
  let goalsRepo: GoalsRepo;
  let bus: TypedEventBus;
  let sync: MarkdownSync;
  let tmpDir: string;
  let mdFile: string;

  beforeEach(async () => {
    db = new Database(':memory:');
    runMigrations(db);
    tasksRepo = new TasksRepo(db);
    goalsRepo = new GoalsRepo(db);
    bus = new TypedEventBus();
    sync = new MarkdownSync(tasksRepo, goalsRepo, bus);
    sync.start();

    tmpDir = await mkdtemp(join(tmpdir(), 'plover-test-'));
    mdFile = join(tmpDir, 'notes.md');
  });

  afterEach(async () => {
    sync.stop();
    try {
      await rmdir(tmpDir, { recursive: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  it('creates a task from a new markdown checklist item', async () => {
    await fs.writeFile(mdFile, '- [ ] Buy groceries\n');

    const payload: FolderEventPayload = { path: mdFile, kind: 'md' };
    bus.emit('folder.file_added', payload);

    await new Promise((resolve) => setTimeout(resolve, 100));

    const allTasks = tasksRepo.list();
    expect(allTasks).toHaveLength(1);
    const [task] = allTasks;
    expect(task?.title).toBe('Buy groceries');
    expect(task?.status).toBe('todo');
    expect(task?.estimate_minutes).toBe(30);
  });

  it('creates task in Inbox goal', async () => {
    await fs.writeFile(mdFile, '- [ ] Task 1\n');

    const payload: FolderEventPayload = { path: mdFile, kind: 'md' };
    bus.emit('folder.file_added', payload);

    await new Promise((resolve) => setTimeout(resolve, 100));

    const goals = goalsRepo.list({ status: 'active' });
    const inboxGoal = goals.find((g) => g.title === 'Inbox');
    expect(inboxGoal).toBeDefined();

    const tasks = tasksRepo.listByGoal(inboxGoal!.id);
    expect(tasks).toHaveLength(1);
  });

  it('marks task as done when checkbox is checked', async () => {
    await fs.writeFile(mdFile, '- [ ] Write report\n');

    const payload: FolderEventPayload = { path: mdFile, kind: 'md' };
    bus.emit('folder.file_added', payload);

    await new Promise((resolve) => setTimeout(resolve, 100));

    let allTasks = tasksRepo.list();
    const [task] = allTasks;
    expect(task?.status).toBe('todo');

    await fs.writeFile(mdFile, '- [x] Write report\n');
    bus.emit('folder.file_changed', payload);

    await new Promise((resolve) => setTimeout(resolve, 100));

    allTasks = tasksRepo.list();
    const [updatedTask] = allTasks;
    expect(updatedTask?.status).toBe('done');
  });

  it('reverts task to todo when checkbox is unchecked', async () => {
    const goals = goalsRepo.list({ status: 'active' });
    if (goals.length === 0) {
      goalsRepo.create({ title: 'Inbox', status: 'active' });
    }
    const goal = goals[0];

    const task = tasksRepo.create({
      goal_id: goal!.id,
      title: 'Complete review',
      estimate_minutes: 30,
      status: 'done',
      depends_on: [],
    });

    await fs.writeFile(mdFile, '- [ ] Complete review\n');

    const payload: FolderEventPayload = { path: mdFile, kind: 'md' };
    bus.emit('folder.file_changed', payload);

    await new Promise((resolve) => setTimeout(resolve, 100));

    const updated = tasksRepo.get(task.id);
    expect(updated?.status).toBe('todo');
  });

  it('is idempotent - re-running on same file does nothing', async () => {
    await fs.writeFile(mdFile, '- [ ] Idempotent task\n');

    const payload: FolderEventPayload = { path: mdFile, kind: 'md' };

    bus.emit('folder.file_added', payload);
    await new Promise((resolve) => setTimeout(resolve, 100));

    const allTasksFirst = tasksRepo.list();
    expect(allTasksFirst).toHaveLength(1);
    const [firstTask] = allTasksFirst;

    bus.emit('folder.file_changed', payload);
    await new Promise((resolve) => setTimeout(resolve, 100));

    const allTasksSecond = tasksRepo.list();
    expect(allTasksSecond).toHaveLength(1);
    const [secondTask] = allTasksSecond;
    expect(secondTask?.id).toBe(firstTask?.id);
  });

  it('matches tasks by normalized title (case-insensitive, trimmed)', async () => {
    await fs.writeFile(mdFile, '- [ ] Buy Groceries\n');

    const payload: FolderEventPayload = { path: mdFile, kind: 'md' };
    bus.emit('folder.file_added', payload);

    await new Promise((resolve) => setTimeout(resolve, 100));

    const allTasks = tasksRepo.list();
    expect(allTasks).toHaveLength(1);

    await fs.writeFile(mdFile, '- [x]   buy groceries   \n');
    bus.emit('folder.file_changed', payload);

    await new Promise((resolve) => setTimeout(resolve, 100));

    const updatedTasks = tasksRepo.list();
    expect(updatedTasks).toHaveLength(1);
    const [task] = updatedTasks;
    expect(task?.status).toBe('done');
  });

  it('ignores non-markdown files', async () => {
    const jsonFile = join(tmpDir, 'data.json');
    await fs.writeFile(jsonFile, '{ "test": true }');

    const payload: FolderEventPayload = { path: jsonFile, kind: 'other' };
    bus.emit('folder.file_added', payload);

    await new Promise((resolve) => setTimeout(resolve, 100));

    const allTasks = tasksRepo.list();
    expect(allTasks).toHaveLength(0);
  });

  it('handles multiple items in one file', async () => {
    const content = `- [ ] First task
- [x] Second task
- [ ] Third task`;

    await fs.writeFile(mdFile, content);

    const payload: FolderEventPayload = { path: mdFile, kind: 'md' };
    bus.emit('folder.file_added', payload);

    await new Promise((resolve) => setTimeout(resolve, 100));

    const allTasks = tasksRepo.list();
    expect(allTasks).toHaveLength(3);

    const [t0, t1, t2] = allTasks;
    expect(t0?.title).toBe('First task');
    expect(t0?.status).toBe('todo');

    expect(t1?.title).toBe('Second task');
    expect(t1?.status).toBe('done');

    expect(t2?.title).toBe('Third task');
    expect(t2?.status).toBe('todo');
  });
});
