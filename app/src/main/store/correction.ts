import { Task } from '../../shared/types.js';
import { SummaryRow } from '../../shared/types.js';
import { TasksRepo } from './repos/tasks.js';
import { SummariesRepo } from './repos/summaries.js';
import { TypedEventBus } from '../events/bus.js';

function reverseEffect(tasksRepo: TasksRepo, row: SummaryRow): void {
  if (!row.task_id) return;
  if (row.progress_delta !== null) {
    tasksRepo.incrementProgress(row.task_id, -row.progress_delta);
  }
  if (row.previous_status !== null) {
    tasksRepo.update(row.task_id, { status: row.previous_status as Task['status'] });
  }
}

function applyEffect(
  tasksRepo: TasksRepo,
  bus: TypedEventBus,
  taskId: string,
  row: SummaryRow,
): void {
  if (row.progress_delta !== null) {
    const updated = tasksRepo.incrementProgress(taskId, row.progress_delta);
    if (updated.progress >= 100 && updated.status !== 'done') {
      const done = tasksRepo.update(taskId, { status: 'done' });
      bus.emit('task.completed', done);
    }
    return;
  }
  const done = tasksRepo.update(taskId, { status: 'done' });
  bus.emit('task.completed', done);
}

function requireSummary(summariesRepo: SummariesRepo, summaryId: number): SummaryRow {
  const row = summariesRepo.get(summaryId);
  if (!row) {
    throw new Error(`Summary with id ${summaryId} not found`);
  }
  if (row.corrected) {
    throw new Error(`Summary ${summaryId} was already corrected`);
  }
  return row;
}

export function undoSummary(
  tasksRepo: TasksRepo,
  summariesRepo: SummariesRepo,
  bus: TypedEventBus,
  summaryId: number,
): SummaryRow {
  const row = requireSummary(summariesRepo, summaryId);

  reverseEffect(tasksRepo, row);
  summariesRepo.markCorrected(summaryId);

  const updated = summariesRepo.get(summaryId);
  if (!updated) {
    throw new Error(`Summary with id ${summaryId} not found after update`);
  }
  bus.emit('summary.corrected', updated);
  return updated;
}

export function reassignSummary(
  tasksRepo: TasksRepo,
  summariesRepo: SummariesRepo,
  bus: TypedEventBus,
  summaryId: number,
  newTaskId: string,
): SummaryRow {
  const row = requireSummary(summariesRepo, summaryId);
  if (!row.task_id) {
    throw new Error(`Summary ${summaryId} has no originating task to reassign from`);
  }
  if (!tasksRepo.get(newTaskId)) {
    throw new Error(`Task with id ${newTaskId} not found`);
  }

  reverseEffect(tasksRepo, row);
  applyEffect(tasksRepo, bus, newTaskId, row);
  summariesRepo.reassignTask(summaryId, newTaskId);

  const updated = summariesRepo.get(summaryId);
  if (!updated) {
    throw new Error(`Summary with id ${summaryId} not found after update`);
  }
  bus.emit('summary.corrected', updated);
  return updated;
}
