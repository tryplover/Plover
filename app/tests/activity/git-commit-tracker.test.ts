import { describe, it, expect, beforeEach, afterEach } from 'vitest';
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
import { TypedEventBus } from '@main/events/bus.js';
import { GitCommitTracker, extractRepoPath } from '@main/activity/git-commit-tracker.js';
import type { GitCommitInfo } from '@shared/events.js';

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
  tracker: GitCommitTracker;
}

function freshHarness(): Harness {
  const db = new Database(':memory:');
  runMigrations(db);
  const tasksRepo = new TasksRepo(db);
  const goalsRepo = new GoalsRepo(db);
  const activityRepo = new ActivityRepo(db);
  const bus = new TypedEventBus();
  const tracker = new GitCommitTracker(activityRepo, bus);
  tracker.start();
  return { db, tasksRepo, goalsRepo, activityRepo, bus, tracker };
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

async function flush(tracker: GitCommitTracker): Promise<void> {
  await (
    tracker as unknown as { enqueue: <T>(fn: () => Promise<T>) => Promise<T> }
  ).enqueue(() => Promise.resolve());
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

  it('emits activity.git_commit on the bus with the parsed commit info', async () => {
    harness = freshHarness();
    seedTask(harness, 'Task A');

    const emitted: GitCommitInfo[] = [];
    harness.bus.on('activity.git_commit', (commit) => {
      emitted.push(commit);
    });

    await makeCommit(repo.repoPath, 'feat: add AST generator');
    harness.bus.emit('folder.file_changed', {
      path: join(repo.repoPath, '.git', 'COMMIT_EDITMSG'),
      kind: 'git_commit_editmsg',
    });

    await flush(harness.tracker);

    expect(emitted).toHaveLength(1);
    expect(emitted[0]?.repoPath).toBe(repo.repoPath);
    expect(emitted[0]?.message).toBe('feat: add AST generator');
    expect(typeof emitted[0]?.hash).toBe('string');
    expect(emitted[0]?.hash.length).toBeGreaterThan(0);
  });

  it('writes a git_commit activity row', async () => {
    harness = freshHarness();

    await makeCommit(repo.repoPath, 'chore: bump deps');
    harness.bus.emit('folder.file_changed', {
      path: join(repo.repoPath, '.git', 'COMMIT_EDITMSG'),
      kind: 'git_commit_editmsg',
    });

    await flush(harness.tracker);

    const activity = harness.activityRepo.listSince('1970-01-01T00:00:00.000Z');
    const commitRows = activity.filter((a) => a.kind === 'git_commit');
    expect(commitRows).toHaveLength(1);
  });

  it('ignores duplicate events for the same commit hash', async () => {
    harness = freshHarness();
    seedTask(harness, 'Task A');

    let emitCount = 0;
    harness.bus.on('activity.git_commit', () => {
      emitCount += 1;
    });

    await makeCommit(repo.repoPath, 'feat: add x');
    const payload = {
      path: join(repo.repoPath, '.git', 'COMMIT_EDITMSG'),
      kind: 'git_commit_editmsg' as const,
    };

    harness.bus.emit('folder.file_changed', payload);
    harness.bus.emit('folder.file_changed', payload);
    harness.bus.emit('folder.file_added', payload);

    await flush(harness.tracker);

    expect(emitCount).toBe(1);
    const activity = harness.activityRepo.listSince('1970-01-01T00:00:00.000Z');
    expect(activity.filter((a) => a.kind === 'git_commit')).toHaveLength(1);
  });

  it('skips events whose kind is not git_commit_editmsg', async () => {
    harness = freshHarness();
    seedTask(harness, 'Task A');

    let emitCount = 0;
    harness.bus.on('activity.git_commit', () => {
      emitCount += 1;
    });

    harness.bus.emit('folder.file_changed', {
      path: join(repo.repoPath, 'notes.md'),
      kind: 'md',
    });
    harness.bus.emit('folder.file_added', {
      path: join(repo.repoPath, 'data.txt'),
      kind: 'other',
    });

    await flush(harness.tracker);

    expect(emitCount).toBe(0);
    const activity = harness.activityRepo.listSince('1970-01-01T00:00:00.000Z');
    expect(activity.filter((a) => a.kind === 'git_commit')).toHaveLength(0);
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

    seedTask(harness, 'Task A');

    // Make a commit which will have a new hash
    await makeCommit(repo.repoPath, 'feat: x');
    harness.bus.emit('folder.file_changed', {
      path: join(repo.repoPath, '.git', 'COMMIT_EDITMSG'),
      kind: 'git_commit_editmsg',
    });

    await flush(harness.tracker);

    // The set and array size should still be 5000
    expect(tracker.seenHashes.size).toBe(5000);
    expect(tracker.seenHashesList.length).toBe(5000);

    // The oldest hash 'hash-1' should be evicted
    expect(tracker.seenHashes.has('hash-1')).toBe(false);
  });
});
