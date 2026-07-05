import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import { runMigrations } from '@main/store/db.js';
import { TasksRepo } from '@main/store/repos/tasks.js';
import { GoalsRepo } from '@main/store/repos/goals.js';
import { ActivityRepo } from '@main/store/repos/activity.js';
import { SummariesRepo } from '@main/store/repos/summaries.js';
import { SettingsRepo } from '@main/store/repos/settings.js';
import { InferenceEngine } from '@main/activity/inference.js';
import { Task } from '@shared/types.js';

import { TypedEventBus } from '@main/bus.js';

function freshHarness(): {
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
  const engine = new InferenceEngine(tasksRepo, activityRepo, summariesRepo, settingsRepo, bus);
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
});
