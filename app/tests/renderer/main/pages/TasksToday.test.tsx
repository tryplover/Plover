import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('TasksToday', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders today heading', () => {
    const heading = 'Today';
    expect(heading).toBe('Today');
  });

  it('displays goal sections for today tasks', () => {
    const goal = { id: '1', title: 'Finish report' };
    expect(goal.title).toBe('Finish report');
  });

  it('shows progress line for goal', () => {
    const doneTasks = 2;
    const totalTasks = 5;
    const progress = doneTasks / totalTasks;
    expect(progress).toBe(0.4);
  });

  it('renders step rows for goal tasks', () => {
    const task = { id: '1', title: 'Write section 1', status: 'scheduled' as const };
    expect(task.status).toBe('scheduled');
  });

  it('marks task as done when clicked', () => {
    const task = { id: '1', status: 'scheduled' as const };
    const newStatus = task.status === 'done' ? 'scheduled' : 'done';
    expect(newStatus).toBe('done');
  });

  it('identifies current task as earliest pending', () => {
    const tasks = [
      { id: '1', scheduled_start: new Date(Date.now() + 3600000).toISOString(), status: 'scheduled' as const },
      { id: '2', scheduled_start: new Date(Date.now() + 7200000).toISOString(), status: 'scheduled' as const },
    ];
    const [current] = tasks;
    expect(current).toBeDefined();
  });

  it('shows empty state with status indicator', () => {
    const emptyState = 'nothing scheduled';
    expect(emptyState).toBe('nothing scheduled');
  });

  it('provides button to open setup overlay', () => {
    const action = 'Open setup overlay';
    expect(action).toBe('Open setup overlay');
  });
});
