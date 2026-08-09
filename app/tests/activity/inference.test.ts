import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Database from 'better-sqlite3';

const mockGetAccessToken = vi.hoisted(() => vi.fn().mockResolvedValue('test-token-xyz'));
vi.mock('../../src/main/auth/supabase-auth.js', () => ({
  getAccessToken: mockGetAccessToken,
}));

import { runMigrations } from '@main/store/db.js';
import { TasksRepo } from '@main/store/repos/tasks.js';
import { GoalsRepo } from '@main/store/repos/goals.js';
import { ActivityRepo } from '@main/store/repos/activity.js';
import { SummariesRepo } from '@main/store/repos/summaries.js';
import { SettingsRepo } from '@main/store/repos/settings.js';
import { InferenceEngine } from '@main/activity/processing/inference/index.js';
import { Task } from '@shared/types.js';

import { TypedEventBus } from '@main/events/bus.js';

function freshHarness(now?: () => Date): {
  db: Database.Database;
  tasksRepo: TasksRepo;
  goalsRepo: GoalsRepo;
  activityRepo: ActivityRepo;
  summariesRepo: SummariesRepo;
  settingsRepo: SettingsRepo;
  bus: TypedEventBus;
  engine: InferenceEngine;
} {
  const db = new Database(':memory:');
  runMigrations(db);
  const tasksRepo = new TasksRepo(db);
  const goalsRepo = new GoalsRepo(db);
  const activityRepo = new ActivityRepo(db);
  const summariesRepo = new SummariesRepo(db);
  const settingsRepo = new SettingsRepo(db);
  const bus = new TypedEventBus();
  const engine = new InferenceEngine(
    tasksRepo,
    activityRepo,
    summariesRepo,
    settingsRepo,
    bus,
    now,
  );
  return { db, tasksRepo, goalsRepo, activityRepo, summariesRepo, settingsRepo, bus, engine };
}

function seedGoalAndTask(
  goalsRepo: GoalsRepo,
  tasksRepo: TasksRepo,
  title: string,
): { taskId: string; goalId: string } {
  const goal = goalsRepo.create({ title: 'Test goal', status: 'active' });
  const task = tasksRepo.create({
    goal_id: goal.id,
    title,
    estimate_minutes: 30,
    status: 'todo',
    depends_on: [],
  });
  return { taskId: task.id, goalId: goal.id };
}

function seedInProgressTask(
  goalsRepo: GoalsRepo,
  tasksRepo: TasksRepo,
  goalId: string,
  title: string,
): string {
  const task = tasksRepo.create({
    goal_id: goalId,
    title,
    estimate_minutes: 30,
    status: 'in_progress',
    depends_on: [],
  });
  return task.id;
}

function fetchBodyOf(fetchSpy: ReturnType<typeof vi.spyOn>): {
  activity: { kind: string }[];
} {
  const [, init] = fetchSpy.mock.calls[0] as [string, { body: string }];
  return JSON.parse(init.body) as { activity: { kind: string }[] };
}

describe('InferenceEngine', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, 'fetch');
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it('marks a task done when the server says completed=true and writes a summary', async () => {
    const { tasksRepo, goalsRepo, activityRepo, summariesRepo, settingsRepo, engine } =
      freshHarness();
    const { taskId } = seedGoalAndTask(goalsRepo, tasksRepo, 'Implement parser');
    activityRepo.insert({
      kind: 'file_modified',
      payload: { path: '/src/parser.ts' },
      ts: '2026-06-12T10:00:00.000Z',
    });

    fetchSpy.mockResolvedValue(
      new Response(
        JSON.stringify({
          task_progress: [
            { taskId, progress_increment: 100, completed: true, reasoning: 'Edited parser.ts' },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    await engine.runInferencePass();

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const updated = tasksRepo.get(taskId);
    expect(updated?.status).toBe('done');

    const summaries = summariesRepo.listForTask(taskId);
    expect(summaries).toHaveLength(1);
    const [s0] = summaries;
    expect(s0?.summary).toBe('Edited parser.ts');
    expect(s0?.signal).toBe(1);
    expect(s0?.source).toBe('inference');
    expect(s0?.progress_delta).toBe(100);
    expect(s0?.previous_status).toBe('todo');

    expect(settingsRepo.getAll().lastInferenceTs).not.toBeNull();
  });

  it('skips the server call when there are no active tasks but still advances lastInferenceTs', async () => {
    const { settingsRepo, engine } = freshHarness();

    await engine.runInferencePass();

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(settingsRepo.getAll().lastInferenceTs).not.toBeNull();
  });

  it('skips the server call when there is no recent activity', async () => {
    const { tasksRepo, goalsRepo, settingsRepo, engine } = freshHarness();
    seedGoalAndTask(goalsRepo, tasksRepo, 'Idle task');

    await engine.runInferencePass();

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(settingsRepo.getAll().lastInferenceTs).not.toBeNull();
  });

  it('does not advance lastInferenceTs when the server responds with a non-2xx status', async () => {
    const { tasksRepo, goalsRepo, activityRepo, settingsRepo, engine } = freshHarness();
    seedGoalAndTask(goalsRepo, tasksRepo, 'A task');
    activityRepo.insert({
      kind: 'file_modified',
      payload: { path: '/src/a.ts' },
      ts: '2026-06-12T10:00:00.000Z',
    });

    fetchSpy.mockResolvedValue(new Response('boom', { status: 500 }));

    await engine.runInferencePass();

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(settingsRepo.getAll().lastInferenceTs).toBeNull();
  });

  it('does not advance lastInferenceTs on a network error', async () => {
    const { tasksRepo, goalsRepo, activityRepo, settingsRepo, engine } = freshHarness();
    seedGoalAndTask(goalsRepo, tasksRepo, 'A task');
    activityRepo.insert({
      kind: 'file_modified',
      payload: { path: '/src/a.ts' },
      ts: '2026-06-12T10:00:00.000Z',
    });

    fetchSpy.mockRejectedValue(new Error('ECONNREFUSED'));

    await engine.runInferencePass();

    expect(settingsRepo.getAll().lastInferenceTs).toBeNull();
  });

  it('ignores server entries that reference unknown task ids', async () => {
    const { tasksRepo, goalsRepo, activityRepo, summariesRepo, engine } = freshHarness();
    const { taskId } = seedGoalAndTask(goalsRepo, tasksRepo, 'Known task');
    activityRepo.insert({
      kind: 'file_modified',
      payload: { path: '/src/a.ts' },
      ts: '2026-06-12T10:00:00.000Z',
    });

    fetchSpy.mockResolvedValue(
      new Response(
        JSON.stringify({
          task_progress: [
            { taskId: 'ghost-id', progress_increment: 50, completed: true, reasoning: 'spoofed' },
            { taskId, progress_increment: 20, completed: false, reasoning: 'real evidence' },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    await engine.runInferencePass();

    expect(tasksRepo.get(taskId)?.status).toBe('todo');
    const summaries = summariesRepo.listForTask(taskId);
    expect(summaries).toHaveLength(1);
    expect(summaries[0]?.summary).toBe('real evidence');
  });

  it('emits task.completed event when the task is completed by inference', async () => {
    const { tasksRepo, goalsRepo, activityRepo, engine, bus } = freshHarness();
    const { taskId } = seedGoalAndTask(goalsRepo, tasksRepo, 'Implement parser');
    activityRepo.insert({
      kind: 'file_modified',
      payload: { path: '/src/parser.ts' },
      ts: '2026-06-12T10:00:00.000Z',
    });

    fetchSpy.mockResolvedValue(
      new Response(
        JSON.stringify({
          task_progress: [
            { taskId, progress_increment: 100, completed: true, reasoning: 'Edited parser.ts' },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    let emittedTask: Task | null = null;
    bus.on('task.completed', (t) => {
      emittedTask = t;
    });

    await engine.runInferencePass();

    expect(emittedTask).not.toBeNull();
    const task = emittedTask as Task | null;
    if (task) {
      expect(task.id).toBe(taskId);
      expect(task.status).toBe('done');
    }
  });

  it('captures previous_status as the pre-pass status, not post-completion status', async () => {
    const { tasksRepo, goalsRepo, activityRepo, summariesRepo, engine } = freshHarness();
    const { taskId } = seedGoalAndTask(goalsRepo, tasksRepo, 'Partial progress task');
    activityRepo.insert({
      kind: 'file_modified',
      payload: { path: '/src/a.ts' },
      ts: '2026-06-12T10:00:00.000Z',
    });

    fetchSpy.mockResolvedValue(
      new Response(
        JSON.stringify({
          task_progress: [
            { taskId, progress_increment: 40, completed: false, reasoning: 'partial work' },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    await engine.runInferencePass();

    const [s0] = summariesRepo.listForTask(taskId);
    expect(s0?.source).toBe('inference');
    expect(s0?.progress_delta).toBe(40);
    expect(s0?.previous_status).toBe('todo');
    expect(tasksRepo.get(taskId)?.status).toBe('todo');
  });

  describe('adaptive fast-tick pacing', () => {
    const T0 = new Date('2026-07-28T09:00:00.000Z');
    const FAST_INTERVAL_MS = 10 * 60_000;
    const BASELINE_INTERVAL_MS = 30 * 60_000;
    const YOUNG_WINDOW_MS = 2 * 60 * 60_000;

    it('uses the fast interval and strips screenshot activity while a task is newly in_progress', async () => {
      const now = T0;
      const { tasksRepo, goalsRepo, activityRepo, engine } = freshHarness(() => now);
      const { goalId } = seedGoalAndTask(goalsRepo, tasksRepo, 'Todo target');
      seedInProgressTask(goalsRepo, tasksRepo, goalId, 'Newly started work');
      activityRepo.insert({
        kind: 'file_modified',
        payload: { path: '/src/a.ts' },
        ts: now.toISOString(),
      });
      activityRepo.insert({
        kind: 'screenshot_inferred',
        payload: {
          screenshotId: 1,
          filePath: '/x.png',
          summary: 'coding',
          activeApp: 'VS Code',
          currentTask: null,
          confidence: 0.5,
        },
        ts: now.toISOString(),
      });

      fetchSpy.mockResolvedValue(
        new Response(JSON.stringify({ task_progress: [] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );

      await engine.runInferencePass();

      expect(engine.pollIntervalMs).toBe(FAST_INTERVAL_MS);
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const kinds = fetchBodyOf(fetchSpy).activity.map((a) => a.kind);
      expect(kinds).toContain('file_modified');
      expect(kinds).not.toContain('screenshot_inferred');
    });

    it('uses the baseline interval and keeps screenshot activity when no task is newly in_progress', async () => {
      const now = T0;
      const { tasksRepo, goalsRepo, activityRepo, engine } = freshHarness(() => now);
      seedGoalAndTask(goalsRepo, tasksRepo, 'Todo target');
      activityRepo.insert({
        kind: 'file_modified',
        payload: { path: '/src/a.ts' },
        ts: now.toISOString(),
      });
      activityRepo.insert({
        kind: 'screenshot_inferred',
        payload: {
          screenshotId: 1,
          filePath: '/x.png',
          summary: 'coding',
          activeApp: 'VS Code',
          currentTask: null,
          confidence: 0.5,
        },
        ts: now.toISOString(),
      });

      fetchSpy.mockResolvedValue(
        new Response(JSON.stringify({ task_progress: [] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );

      await engine.runInferencePass();

      expect(engine.pollIntervalMs).toBe(BASELINE_INTERVAL_MS);
      const kinds = fetchBodyOf(fetchSpy).activity.map((a) => a.kind);
      expect(kinds).toContain('file_modified');
      expect(kinds).toContain('screenshot_inferred');
    });

    it('falls back to the baseline interval once a task ages out of the young window', async () => {
      let now = T0;
      const { tasksRepo, goalsRepo, activityRepo, engine } = freshHarness(() => now);
      const { goalId } = seedGoalAndTask(goalsRepo, tasksRepo, 'Todo target');
      seedInProgressTask(goalsRepo, tasksRepo, goalId, 'Newly started work');
      activityRepo.insert({
        kind: 'file_modified',
        payload: { path: '/src/a.ts' },
        ts: now.toISOString(),
      });

      fetchSpy.mockResolvedValue(
        new Response(JSON.stringify({ task_progress: [] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );

      await engine.runInferencePass();
      expect(engine.pollIntervalMs).toBe(FAST_INTERVAL_MS);

      now = new Date(T0.getTime() + YOUNG_WINDOW_MS + 1);
      activityRepo.insert({
        kind: 'file_modified',
        payload: { path: '/src/b.ts' },
        ts: now.toISOString(),
      });
      await engine.runInferencePass();

      expect(engine.pollIntervalMs).toBe(BASELINE_INTERVAL_MS);
    });

    it('reverts to the baseline interval as soon as the task leaves in_progress, without waiting out the window', async () => {
      const now = T0;
      const { tasksRepo, goalsRepo, activityRepo, engine } = freshHarness(() => now);
      const { goalId } = seedGoalAndTask(goalsRepo, tasksRepo, 'Todo target');
      const activeTaskId = seedInProgressTask(goalsRepo, tasksRepo, goalId, 'Newly started work');
      activityRepo.insert({
        kind: 'file_modified',
        payload: { path: '/src/a.ts' },
        ts: now.toISOString(),
      });

      fetchSpy.mockResolvedValue(
        new Response(JSON.stringify({ task_progress: [] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );

      await engine.runInferencePass();
      expect(engine.pollIntervalMs).toBe(FAST_INTERVAL_MS);

      tasksRepo.update(activeTaskId, { status: 'done' });
      activityRepo.insert({
        kind: 'file_modified',
        payload: { path: '/src/b.ts' },
        ts: now.toISOString(),
      });
      await engine.runInferencePass();

      expect(engine.pollIntervalMs).toBe(BASELINE_INTERVAL_MS);
    });
  });
});
