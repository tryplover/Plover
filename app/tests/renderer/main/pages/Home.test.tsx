// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Home from '../../../../src/renderer/main/pages/Home/Home';
import type { Goal, Task } from '../../../../src/shared/types';

const mockUnsubscribe = vi.fn();

const mockGoal: Goal = {
  id: 'goal-1',
  title: 'Test Goal',
  description: 'A test goal description',
  status: 'active',
  created_at: '2026-07-31T00:00:00Z',
  updated_at: '2026-07-31T00:00:00Z',
};

const mockInProgressTask: Task = {
  id: 'task-1',
  goal_id: 'goal-1',
  title: 'Active Task',
  estimate_minutes: 60,
  status: 'in_progress',
  sort_index: 0,
  progress: 0.5,
  created_at: '2026-07-31T00:00:00Z',
  updated_at: '2026-07-31T00:00:00Z',
};

const mockTodoTask: Task = {
  id: 'task-2',
  goal_id: 'goal-1',
  title: 'Todo Task',
  estimate_minutes: 30,
  status: 'todo',
  sort_index: 1,
  progress: 0,
  created_at: '2026-07-31T00:00:00Z',
  updated_at: '2026-07-31T00:00:00Z',
};

beforeEach(() => {
  localStorage.setItem('plover_onboarding_completed', 'true');
  vi.clearAllMocks();
  Object.defineProperty(window, 'api', {
    value: {
      getTasks: vi.fn().mockResolvedValue([]),
      getGoals: vi.fn().mockResolvedValue([]),
      getTaskById: vi.fn().mockResolvedValue(null),
      updateTaskStatus: vi.fn().mockResolvedValue(mockInProgressTask),
      deleteGoal: vi.fn().mockResolvedValue(undefined),
      deleteTask: vi.fn().mockResolvedValue(undefined),
      getSettings: vi.fn().mockResolvedValue({
        googleConnected: false,
        workingHours: { start: '09:00', end: '18:00' },
        horizonDays: 14,
        pauseScheduling: false,
        theme: 'light',
      }),
      companion: {
        getInitialState: vi.fn().mockResolvedValue({ kind: 'observing' }),
      },
      auth: {
        getStatus: vi.fn().mockResolvedValue({ signedIn: false, email: null }),
      },
      on: vi.fn().mockReturnValue(mockUnsubscribe),
    },
    writable: true,
    configurable: true,
  });
});

describe('Home', () => {
  it('renders the Finish button when there is an active task', async () => {
    vi.mocked(window.api.getGoals).mockResolvedValue([mockGoal]);
    vi.mocked(window.api.getTasks).mockResolvedValue([mockInProgressTask, mockTodoTask]);

    render(<Home data-testid="page-home" />);

    // Wait for the goal to be displayed
    expect(await screen.findByText('Test Goal')).toBeTruthy();

    // Find the Finish button by aria-label
    const finishButton = screen.getByLabelText('Finish current task');
    expect(finishButton).toBeTruthy();
  });

  it('calls updateTaskStatus with the active task id and "done" status when Finish is clicked', async () => {
    vi.mocked(window.api.updateTaskStatus).mockResolvedValue({
      ...mockInProgressTask,
      status: 'done',
    });
    vi.mocked(window.api.getGoals).mockResolvedValue([mockGoal]);
    vi.mocked(window.api.getTasks).mockResolvedValue([mockInProgressTask, mockTodoTask]);

    render(<Home data-testid="page-home" />);

    // Wait for the goal and finish button to be displayed
    expect(await screen.findByText('Test Goal')).toBeTruthy();
    const finishButton = screen.getByLabelText('Finish current task');

    // Click the finish button
    fireEvent.click(finishButton);

    // Wait for the updateTaskStatus to be called
    await waitFor(() => {
      expect(vi.mocked(window.api.updateTaskStatus)).toHaveBeenCalledWith(
        mockInProgressTask.id,
        'done',
      );
    });
  });

  it('does not show the Finish button when no active task exists', async () => {
    vi.mocked(window.api.getGoals).mockResolvedValue([]);
    vi.mocked(window.api.getTasks).mockResolvedValue([]);

    render(<Home data-testid="page-home" />);

    // Wait for the empty state to appear
    expect(
      await screen.findByText(
        'No tasks yet. Define one, and Plover fills the bar as you actually do it — no timers, no guilt, just real progress.',
      ),
    ).toBeTruthy();

    // Assert the Finish button is not present
    expect(screen.queryByLabelText('Finish current task')).toBeNull();
  });
});
