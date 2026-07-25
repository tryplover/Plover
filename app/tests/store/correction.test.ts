import { describe, it, expect } from 'vitest';
import Database from 'better-sqlite3';
import { runMigrations } from '@main/store/db.js';
import { TasksRepo } from '@main/store/repos/tasks.js';
import { GoalsRepo } from '@main/store/repos/goals.js';
import { SummariesRepo } from '@main/store/repos/summaries.js';
import { TypedEventBus } from '@main/events/bus.js';
import { undoSummary, reassignSummary } from '@main/store/correction.js';

function harness() {
  const db = new Database(':memory:');
  runMigrations(db);
  const tasksRepo = new TasksRepo(db);
  const goalsRepo = new GoalsRepo(db);
  const summariesRepo = new SummariesRepo(db);
  const bus = new TypedEventBus();
  const goal = goalsRepo.create({ title: 'Test goal', status: 'active' });
  return { db, tasksRepo, goalsRepo, summariesRepo, bus, goalId: goal.id };
}

describe('undoSummary', () => {
  it('reverses a progress_delta and restores previous_status', () => {
    const { tasksRepo, summariesRepo, bus, goalId } = harness();
    const task = tasksRepo.create({
      goal_id: goalId,
      title: 't',
      estimate_minutes: 30,
      status: 'todo',
      depends_on: [],
    });
    tasksRepo.incrementProgress(task.id, 60);
    const summary = summariesRepo.insert({
      taskId: task.id,
      summary: 'e',
      signal: 0.6,
      source: 'inference',
      progressDelta: 60,
      previousStatus: 'todo',
    });

    const result = undoSummary(tasksRepo, summariesRepo, bus, summary.id);

    expect(result.corrected).toBe(1);
    expect(tasksRepo.get(task.id)?.progress).toBe(0);
    expect(tasksRepo.get(task.id)?.status).toBe('todo');
  });

  it('restores status for a commit_match row with no progress_delta', () => {
    const { tasksRepo, summariesRepo, bus, goalId } = harness();
    const task = tasksRepo.create({
      goal_id: goalId,
      title: 't',
      estimate_minutes: 30,
      status: 'todo',
      depends_on: [],
    });
    tasksRepo.update(task.id, { status: 'done' });
    const summary = summariesRepo.insert({
      taskId: task.id,
      summary: 'matched commit',
      signal: 1,
      source: 'commit_match',
      previousStatus: 'todo',
    });

    undoSummary(tasksRepo, summariesRepo, bus, summary.id);

    expect(tasksRepo.get(task.id)?.status).toBe('todo');
  });

  it('emits summary.corrected', () => {
    const { tasksRepo, summariesRepo, bus, goalId } = harness();
    const task = tasksRepo.create({
      goal_id: goalId,
      title: 't',
      estimate_minutes: 30,
      status: 'todo',
      depends_on: [],
    });
    const summary = summariesRepo.insert({
      taskId: task.id,
      summary: 'e',
      signal: 0.5,
      source: 'inference',
      progressDelta: 30,
      previousStatus: 'todo',
    });

    let emitted: unknown = null;
    bus.on('summary.corrected', (s) => {
      emitted = s;
    });
    undoSummary(tasksRepo, summariesRepo, bus, summary.id);

    expect(emitted).not.toBeNull();
  });

  it('throws for an already-corrected summary', () => {
    const { tasksRepo, summariesRepo, bus, goalId } = harness();
    const task = tasksRepo.create({
      goal_id: goalId,
      title: 't',
      estimate_minutes: 30,
      status: 'todo',
      depends_on: [],
    });
    const summary = summariesRepo.insert({
      taskId: task.id,
      summary: 'e',
      signal: 0.5,
      source: 'inference',
      progressDelta: 10,
      previousStatus: 'todo',
    });
    undoSummary(tasksRepo, summariesRepo, bus, summary.id);

    expect(() => undoSummary(tasksRepo, summariesRepo, bus, summary.id)).toThrow();
  });

  it('throws for an unknown summary id', () => {
    const { tasksRepo, summariesRepo, bus } = harness();
    expect(() => undoSummary(tasksRepo, summariesRepo, bus, 999999)).toThrow();
  });
});

describe('reassignSummary', () => {
  it('moves a progress_delta from the old task to the new task', () => {
    const { tasksRepo, summariesRepo, bus, goalId } = harness();
    const oldTask = tasksRepo.create({
      goal_id: goalId,
      title: 'old',
      estimate_minutes: 30,
      status: 'todo',
      depends_on: [],
    });
    const newTask = tasksRepo.create({
      goal_id: goalId,
      title: 'new',
      estimate_minutes: 30,
      status: 'todo',
      depends_on: [],
    });
    tasksRepo.incrementProgress(oldTask.id, 40);
    const summary = summariesRepo.insert({
      taskId: oldTask.id,
      summary: 'e',
      signal: 0.4,
      source: 'inference',
      progressDelta: 40,
      previousStatus: 'todo',
    });

    const result = reassignSummary(tasksRepo, summariesRepo, bus, summary.id, newTask.id);

    expect(result.task_id).toBe(newTask.id);
    expect(result.corrected).toBe(1);
    expect(tasksRepo.get(oldTask.id)?.progress).toBe(0);
    expect(tasksRepo.get(newTask.id)?.progress).toBe(40);
  });

  it('auto-completes the new task if the reapplied delta reaches 100', () => {
    const { tasksRepo, summariesRepo, bus, goalId } = harness();
    const oldTask = tasksRepo.create({
      goal_id: goalId,
      title: 'old',
      estimate_minutes: 30,
      status: 'todo',
      depends_on: [],
    });
    const newTask = tasksRepo.create({
      goal_id: goalId,
      title: 'new',
      estimate_minutes: 30,
      status: 'todo',
      depends_on: [],
    });
    tasksRepo.incrementProgress(oldTask.id, 100);
    const summary = summariesRepo.insert({
      taskId: oldTask.id,
      summary: 'e',
      signal: 1,
      source: 'inference',
      progressDelta: 100,
      previousStatus: 'todo',
    });

    reassignSummary(tasksRepo, summariesRepo, bus, summary.id, newTask.id);

    expect(tasksRepo.get(newTask.id)?.status).toBe('done');
  });

  it('re-flips the new task to done for a commit_match reassignment', () => {
    const { tasksRepo, summariesRepo, bus, goalId } = harness();
    const oldTask = tasksRepo.create({
      goal_id: goalId,
      title: 'old',
      estimate_minutes: 30,
      status: 'todo',
      depends_on: [],
    });
    const newTask = tasksRepo.create({
      goal_id: goalId,
      title: 'new',
      estimate_minutes: 30,
      status: 'todo',
      depends_on: [],
    });
    tasksRepo.update(oldTask.id, { status: 'done' });
    const summary = summariesRepo.insert({
      taskId: oldTask.id,
      summary: 'matched',
      signal: 1,
      source: 'commit_match',
      previousStatus: 'todo',
    });

    reassignSummary(tasksRepo, summariesRepo, bus, summary.id, newTask.id);

    expect(tasksRepo.get(oldTask.id)?.status).toBe('todo');
    expect(tasksRepo.get(newTask.id)?.status).toBe('done');
  });

  it('throws when reassigning a summary with no originating task', () => {
    const { tasksRepo, summariesRepo, bus, goalId } = harness();
    const newTask = tasksRepo.create({
      goal_id: goalId,
      title: 'new',
      estimate_minutes: 30,
      status: 'todo',
      depends_on: [],
    });
    const summary = summariesRepo.insert({
      taskId: null,
      summary: 'global',
      signal: 0.5,
      source: 'inference',
    });

    expect(() => reassignSummary(tasksRepo, summariesRepo, bus, summary.id, newTask.id)).toThrow();
  });

  it('throws when the target task does not exist', () => {
    const { tasksRepo, summariesRepo, bus, goalId } = harness();
    const oldTask = tasksRepo.create({
      goal_id: goalId,
      title: 'old',
      estimate_minutes: 30,
      status: 'todo',
      depends_on: [],
    });
    const summary = summariesRepo.insert({
      taskId: oldTask.id,
      summary: 'e',
      signal: 0.5,
      source: 'inference',
      progressDelta: 10,
      previousStatus: 'todo',
    });

    expect(() =>
      reassignSummary(tasksRepo, summariesRepo, bus, summary.id, 'nonexistent-task'),
    ).toThrow();
  });
});
