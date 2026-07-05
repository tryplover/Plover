import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GitCommitTracker } from '@main/activity/git-commit-tracker.js';
import { TypedEventBus } from '@main/bus.js';
import * as child_process from 'node:child_process';
import type { TasksRepo } from '@main/store/repos/tasks.js';
import type { ActivityRepo } from '@main/store/repos/activity.js';

vi.mock('node:child_process', async () => {
  const actual = await vi.importActual('node:child_process') as object;
  return {
    ...actual,
    execFile: vi.fn(),
  };
});

describe('GitCommitTracker Security', () => {
  let tasksRepo: TasksRepo;
  let activityRepo: ActivityRepo;
  let bus: TypedEventBus;
  let tracker: GitCommitTracker;

  beforeEach(() => {
    tasksRepo = { list: vi.fn().mockReturnValue([]), update: vi.fn() } as unknown as TasksRepo;
    activityRepo = { insert: vi.fn() } as unknown as ActivityRepo;
    bus = new TypedEventBus();
    tracker = new GitCommitTracker(tasksRepo, activityRepo, bus);
    tracker.start();
    vi.clearAllMocks();
  });

  it('does NOT call git if repoPath starts with a dash', async () => {
    const mockExecFile = vi.mocked(child_process.execFile);
    mockExecFile.mockImplementation((_file: string, _args: string[], _options: unknown, callback: (err: null, res: { stdout: string }) => void) => {
      callback(null, { stdout: 'hash\nmessage' });
    });

    // A crafted path that looks like a git option
    const maliciousPath = '-v';
    // This path would be extracted from something like "-v/.git/COMMIT_EDITMSG"
    const filePath = `${maliciousPath}/.git/COMMIT_EDITMSG`;

    // Trigger the tracker
    bus.emit('folder.file_changed', {
      path: filePath,
      kind: 'git_commit_editmsg',
    });

    // Wait for the async processing
    await (tracker as unknown as { inflight: Promise<void> }).inflight;

    // Check if git was called - it SHOULD NOT be called
    expect(mockExecFile).not.toHaveBeenCalled();
  });
});
