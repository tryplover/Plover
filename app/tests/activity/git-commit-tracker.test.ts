import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Task } from '@shared/types.js';
import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import Database from 'better-sqlite3';
import { runMigrations } from '@main/store/db.js';
import { TasksRepo } from '@main/store/repos/tasks.js';
import { GoalsRepo } from '@main/store/repos/goals.js';
import { ActivityRepo } from '@main/store/repos/activity.js';
import { TypedEventBus } from '@main/bus.js';
import {
  GitCommitTracker,
  extractRepoPath,
  type CommitMatcher,
  type MatchCommitResponse,
} from '@main/activity/git-commit-tracker.js';

const execFileAsync = promisify(execFile);

async function setupRepo(): Promise<{ repoPath: string; cleanup: () => Promise<void> }> {
  const repoPath = await mkdtemp(join(tmpdir(), 'plover-git-'));
  await execFileAsync('git', ['-C', repoPath, 'init', '-q']);
  await execFileAsync('git', ['-C', repoPath, 'config', 'user.email', 'test@example.com']);
  await execFileAsync('git', ['-C', repoPath, 'config', 'user.name', 'Test']);
  await execFileAsync('git', ['-C', repoPath, 'config', 'commit.gpgsign', 'false']);
  return {
    repoPath,
    cleanup: () => rm(repoPath, { recursive: true, force: true }),
  };
}

async function makeCommit(repoPath: string, message: string, file = 'a.txt'): Promise<void> {
  await writeFile(join(repoPath, file), `content ${Date.now()}\n`);
  await execFileAsync('git', ['-C', repoPath, 'add', file]);
  await execFileAsync('git', ['-C', repoPath, 'commit', '-m', message, '--allow-empty']);
  await mkdir(join(repoPath, '.git'), { recursive: true });
  await writeFile(join(repoPath, '.git', 'COMMIT_EDITMSG'), message);
}

interface Harness {
  db: Database.Database;
  tasksRepo: TasksRepo;
  goalsRepo: GoalsRepo;
  activityRepo: ActivityRepo;
  bus: TypedEventBus;
  notifySpy: ReturnType<typeof vi.fn>;
  matcherSpy: ReturnType<typeof vi.fn>;
  tracker: GitCommitTracker;
}

function freshHarness(matcherImpl?: CommitMatcher): Harness {
  const db = new Database(':memory:');
  runMigrations(db);
  const tasksRepo = new TasksRepo(db);
  const goalsRepo = new GoalsRepo(db);
  const activityRepo = new ActivityRepo(db);
  const bus = new TypedEventBus();
  const notifySpy = vi.fn();
  const matcherSpy = vi.fn(
    matcherImpl ??
      (async () => ({ matchedTaskId: null, reasoning: 'no match' }) as MatchCommitResponse),
  );
  const tracker = new GitCommitTracker(
    tasksRepo,
    activityRepo,
    bus,
    matcherSpy as unknown as CommitMatcher,
    notifySpy,
  );
  tracker.start();
  return { db, tasksRepo, goalsRepo, activityRepo, bus, notifySpy, matcherSpy, tracker };
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

describe('extractRepoPath', () => {
  it('returns the repo root for a posix COMMIT_EDITMSG path', () => {
    expect(extractRepoPath('/Users/me/repo/.git/COMMIT_EDITMSG')).toBe('/Users/me/repo');
  });

  it('normalizes Windows-style backslashes', () => {
    expect(extractRepoPath('C:\\code\\repo\\.git\\COMMIT_EDITMSG')).toBe('C:/code/repo');
  });

  it('returns null for non-COMMIT_EDITMSG paths', () => {
    expect(extractRepoPath('/repo/.git/HEAD')).toBeNull();
    expect(extractRepoPath('/repo/README.md')).toBeNull();
  });
});

describe('GitCommitTracker', () => {
  let repo: { repoPath: string; cleanup: () => Promise<void> };
  let harness: Harness;

  beforeEach(async () => {
    repo = await setupRepo();
  });

  afterEach(async () => {
    harness?.tracker.stop();
    await repo.cleanup();
  });

  it('marks the matched task done and fires a notification when the matcher returns a task id', async () => {
    harness = freshHarness();
    const { taskId } = seedTask(harness, 'Implement AST generator');
    harness.matcherSpy.mockResolvedValue({
      matchedTaskId: taskId,
      reasoning: 'message mentions AST',
    });

    await makeCommit(repo.repoPath, 'feat: add AST generator');
    harness.bus.emit('folder.file_changed', {
      path: join(repo.repoPath, '.git', 'COMMIT_EDITMSG'),
      kind: 'git_commit_editmsg',
    });

    await (harness.tracker as unknown as { inflight: Promise<void> }).inflight;

    expect(harness.matcherSpy).toHaveBeenCalledTimes(1);
    expect(harness.tasksRepo.get(taskId)?.status).toBe('done');
    expect(harness.notifySpy).toHaveBeenCalledTimes(1);
    const activity = harness.activityRepo.listSince('1970-01-01T00:00:00.000Z');
    const commitRows = activity.filter((a) => a.kind === 'git_commit');
    expect(commitRows).toHaveLength(1);
  });

  it('does nothing when the matcher returns null', async () => {
    harness = freshHarness();
    const { taskId } = seedTask(harness, 'Some task');
    harness.matcherSpy.mockResolvedValue({ matchedTaskId: null, reasoning: 'no match' });

    await makeCommit(repo.repoPath, 'chore: bump deps');
    harness.bus.emit('folder.file_changed', {
      path: join(repo.repoPath, '.git', 'COMMIT_EDITMSG'),
      kind: 'git_commit_editmsg',
    });

    await (harness.tracker as unknown as { inflight: Promise<void> }).inflight;

    expect(harness.matcherSpy).toHaveBeenCalledTimes(1);
    expect(harness.tasksRepo.get(taskId)?.status).toBe('todo');
    expect(harness.notifySpy).not.toHaveBeenCalled();
  });

  it('ignores duplicate events for the same commit hash', async () => {
    harness = freshHarness();
    seedTask(harness, 'Task A');

    await makeCommit(repo.repoPath, 'feat: add x');
    const payload = {
      path: join(repo.repoPath, '.git', 'COMMIT_EDITMSG'),
      kind: 'git_commit_editmsg' as const,
    };

    harness.bus.emit('folder.file_changed', payload);
    harness.bus.emit('folder.file_changed', payload);
    harness.bus.emit('folder.file_added', payload);

    await (harness.tracker as unknown as { inflight: Promise<void> }).inflight;

    expect(harness.matcherSpy).toHaveBeenCalledTimes(1);
    const activity = harness.activityRepo.listSince('1970-01-01T00:00:00.000Z');
    expect(activity.filter((a) => a.kind === 'git_commit')).toHaveLength(1);
  });

  it('skips events whose kind is not git_commit_editmsg', async () => {
    harness = freshHarness();
    seedTask(harness, 'Task A');

    harness.bus.emit('folder.file_changed', {
      path: join(repo.repoPath, 'notes.md'),
      kind: 'md',
    });
    harness.bus.emit('folder.file_added', {
      path: join(repo.repoPath, 'data.txt'),
      kind: 'other',
    });

    await (harness.tracker as unknown as { inflight: Promise<void> }).inflight;

    expect(harness.matcherSpy).not.toHaveBeenCalled();
  });

  it('skips the matcher call when there are no active tasks', async () => {
    harness = freshHarness();

    await makeCommit(repo.repoPath, 'feat: something');
    harness.bus.emit('folder.file_changed', {
      path: join(repo.repoPath, '.git', 'COMMIT_EDITMSG'),
      kind: 'git_commit_editmsg',
    });

    await (harness.tracker as unknown as { inflight: Promise<void> }).inflight;

    expect(harness.matcherSpy).not.toHaveBeenCalled();
  });

  it('ignores a matcher response that names an unknown task id', async () => {
    harness = freshHarness();
    const { taskId } = seedTask(harness, 'Real task');
    harness.matcherSpy.mockResolvedValue({
      matchedTaskId: 'ghost-id',
      reasoning: 'spoofed',
    });

    await makeCommit(repo.repoPath, 'feat: real');
    harness.bus.emit('folder.file_changed', {
      path: join(repo.repoPath, '.git', 'COMMIT_EDITMSG'),
      kind: 'git_commit_editmsg',
    });

    await (harness.tracker as unknown as { inflight: Promise<void> }).inflight;

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

    await makeCommit(repo.repoPath, 'feat: add AST generator');
    harness.bus.emit('folder.file_changed', {
      path: join(repo.repoPath, '.git', 'COMMIT_EDITMSG'),
      kind: 'git_commit_editmsg',
    });

    await (harness.tracker as unknown as { inflight: Promise<void> }).inflight;

    const completedTask = await completedPromise;
    expect(completedTask.id).toBe(taskId);
    expect(completedTask.status).toBe('done');
  });

  it('caps seenHashes list at 5000 and evicts the oldest entries', async () => {
    harness = freshHarness();
    const tracker = harness.tracker as unknown as {
      seenHashes: Set<string>;
      seenHashesList: string[];
    };

    // Seed 5000 hashes
    for (let i = 1; i <= 5000; i++) {
      const hash = `hash-${i}`;
      tracker.seenHashes.add(hash);
      tracker.seenHashesList.push(hash);
    }

    const { taskId } = seedTask(harness, 'Task A');
    harness.matcherSpy.mockResolvedValue({ matchedTaskId: taskId, reasoning: 'match' });

    // Make a commit which will have a new hash
    await makeCommit(repo.repoPath, 'feat: x');
    harness.bus.emit('folder.file_changed', {
      path: join(repo.repoPath, '.git', 'COMMIT_EDITMSG'),
      kind: 'git_commit_editmsg',
    });

    await (harness.tracker as unknown as { inflight: Promise<void> }).inflight;

    // The set and array size should still be 5000
    expect(tracker.seenHashes.size).toBe(5000);
    expect(tracker.seenHashesList.length).toBe(5000);

    // The oldest hash 'hash-1' should be evicted
    expect(tracker.seenHashes.has('hash-1')).toBe(false);
  });
});
