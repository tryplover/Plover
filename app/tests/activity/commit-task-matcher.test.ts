import { describe, it, expect, afterEach, vi } from 'vitest';
import { Task } from '@shared/types.js';
import Database from 'better-sqlite3';
import { runMigrations } from '@main/store/db.js';
import { TasksRepo } from '@main/store/repos/tasks.js';
import { GoalsRepo } from '@main/store/repos/goals.js';
import { SummariesRepo } from '@main/store/repos/summaries.js';
import { TypedEventBus } from '@main/events/bus.js';
import {
  CommitTaskMatcher,
  type CommitMatcher,
  type MatchCommitResponse,
} from '@main/activity/processing/commit-task-matcher/index.js';
import type { GitCommitInfo } from '@shared/events.js';

function makeCommit(overrides: Partial<GitCommitInfo> = {}): GitCommitInfo {
  return {
    repoPath: '/repo',
    hash: 'abc123',
    message: 'feat: add AST generator',
    ...overrides,
  };
}

interface Harness {
  db: Database.Database;
  tasksRepo: TasksRepo;
  goalsRepo: GoalsRepo;
  summariesRepo: SummariesRepo;
  bus: TypedEventBus;
  notifySpy: ReturnType<typeof vi.fn>;
  matcherSpy: ReturnType<typeof vi.fn>;
  matcher: CommitTaskMatcher;
}

function freshHarness(matcherImpl?: CommitMatcher): Harness {
  const db = new Database(':memory:');
  runMigrations(db);
  const tasksRepo = new TasksRepo(db);
  const goalsRepo = new GoalsRepo(db);
  const summariesRepo = new SummariesRepo(db);
  const bus = new TypedEventBus();
  const notifySpy = vi.fn();
  const matcherSpy = vi.fn(
    matcherImpl ??
      (async () => ({ matchedTaskId: null, reasoning: 'no match' }) as MatchCommitResponse),
  );
  const matcher = new CommitTaskMatcher(
    tasksRepo,
    summariesRepo,
    bus,
    matcherSpy as unknown as CommitMatcher,
    notifySpy,
  );
  matcher.start();
  return { db, tasksRepo, goalsRepo, summariesRepo, bus, notifySpy, matcherSpy, matcher };
}

function seedTask(h: Pick<Harness, 'tasksRepo' | 'goalsRepo'>, title: string): { taskId: string } {
  const goal = h.goalsRepo.create({ title: 'Test goal', status: 'active' });
  const t = h.tasksRepo.create({
    goal_id: goal.id,
    title,
    estimate_minutes: 60,
    status: 'todo',
    depends_on: [],
  });
  return { taskId: t.id };
}

async function flush(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe('CommitTaskMatcher', () => {
  let harness: Harness;

  afterEach(() => {
    harness?.matcher.stop();
  });

  it('marks the matched task done and fires a notification when the matcher returns a task id', async () => {
    harness = freshHarness();
    const { taskId } = seedTask(harness, 'Implement AST generator');
    harness.matcherSpy.mockResolvedValue({
      matchedTaskId: taskId,
      reasoning: 'message mentions AST',
    });

    harness.bus.emit('activity.git_commit', makeCommit());
    await flush();

    expect(harness.matcherSpy).toHaveBeenCalledTimes(1);
    expect(harness.tasksRepo.get(taskId)?.status).toBe('done');
    expect(harness.notifySpy).toHaveBeenCalledTimes(1);
  });

  it('writes a commit_match summary row with previous_status captured pre-update', async () => {
    harness = freshHarness();
    const { taskId } = seedTask(harness, 'Implement AST generator');
    harness.matcherSpy.mockResolvedValue({
      matchedTaskId: taskId,
      reasoning: 'Commit message references AST generator',
    });

    harness.bus.emit('activity.git_commit', makeCommit());
    await flush();

    const [summary] = harness.summariesRepo.listForTask(taskId);
    expect(summary?.source).toBe('commit_match');
    expect(summary?.signal).toBe(1);
    expect(summary?.previous_status).toBe('todo');
    expect(summary?.progress_delta).toBeNull();
    expect(summary?.summary).toBe('Commit message references AST generator');
  });

  it('emits summary.created on the bus when a commit_match summary is written', async () => {
    harness = freshHarness();
    const { taskId } = seedTask(harness, 'Implement AST generator');
    harness.matcherSpy.mockResolvedValue({
      matchedTaskId: taskId,
      reasoning: 'message mentions AST',
    });

    const summaryPromise = new Promise((resolve) => {
      harness.bus.once('summary.created', resolve);
    });

    harness.bus.emit('activity.git_commit', makeCommit());

    const summary = await summaryPromise;
    expect(summary).toMatchObject({ task_id: taskId, source: 'commit_match' });
  });

  it('does nothing when the matcher returns null', async () => {
    harness = freshHarness();
    const { taskId } = seedTask(harness, 'Some task');
    harness.matcherSpy.mockResolvedValue({ matchedTaskId: null, reasoning: 'no match' });

    harness.bus.emit('activity.git_commit', makeCommit());
    await flush();

    expect(harness.matcherSpy).toHaveBeenCalledTimes(1);
    expect(harness.tasksRepo.get(taskId)?.status).toBe('todo');
    expect(harness.notifySpy).not.toHaveBeenCalled();
  });

  it('skips the matcher call when there are no active tasks', async () => {
    harness = freshHarness();

    harness.bus.emit('activity.git_commit', makeCommit());
    await flush();

    expect(harness.matcherSpy).not.toHaveBeenCalled();
  });

  it('ignores a matcher response that names an unknown task id', async () => {
    harness = freshHarness();
    const { taskId } = seedTask(harness, 'Real task');
    harness.matcherSpy.mockResolvedValue({
      matchedTaskId: 'ghost-id',
      reasoning: 'spoofed',
    });

    harness.bus.emit('activity.git_commit', makeCommit());
    await flush();

    expect(harness.tasksRepo.get(taskId)?.status).toBe('todo');
    expect(harness.notifySpy).not.toHaveBeenCalled();
  });

  it('emits task.completed event on bus when task is marked done', async () => {
    harness = freshHarness();
    const { taskId } = seedTask(harness, 'Implement AST generator');
    harness.matcherSpy.mockResolvedValue({
      matchedTaskId: taskId,
      reasoning: 'message mentions AST',
    });

    const completedPromise = new Promise<Task>((resolve) => {
      harness.bus.once('task.completed', (task) => {
        resolve(task);
      });
    });

    harness.bus.emit('activity.git_commit', makeCommit());

    const completedTask = await completedPromise;
    expect(completedTask.id).toBe(taskId);
    expect(completedTask.status).toBe('done');
  });
});
