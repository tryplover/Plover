// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import GoalsList from '../../../../src/renderer/main/pages/GoalsList';
import { Goal, Task } from '../../../../src/shared/types';

const mockUnsubscribe = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(window, 'api', {
    value: {
      getGoals: vi.fn().mockResolvedValue([]),
      getTasks: vi.fn().mockResolvedValue([]),
      updateTaskStatus: vi.fn().mockResolvedValue({}),
      on: vi.fn().mockReturnValue(mockUnsubscribe),
    },
    writable: true,
    configurable: true,
  });
});

describe('GoalsList', () => {
  it('renders the Goals heading', async () => {
    render(<GoalsList />);
    expect(await screen.findByRole('heading', { name: 'Goals' })).toBeTruthy();
  });

  it('renders the goal input placeholder in the setup flow modal', async () => {
    render(<GoalsList />);
    const createBtn = await screen.findByRole('button', { name: '+ Create Goal' });
    createBtn.click();
    expect(
      await screen.findByPlaceholderText('Finish the methods section of my thesis'),
    ).toBeTruthy();
  });

  it('forwards data-testid to root element', async () => {
    render(<GoalsList data-testid="page-goals" />);
    expect(await screen.findByTestId('page-goals')).toBeTruthy();
  });

  it('displays error message when task status update fails', async () => {
    const mockTask = {
      id: 'task-1',
      goal_id: 'goal-1',
      title: 'Task 1',
      status: 'scheduled',
      scheduled_start: new Date().toISOString(),
    } as Task;
    const mockGoal = { id: 'goal-1', title: 'Goal 1' } as Goal;

    vi.mocked(window.api.getGoals).mockResolvedValue([mockGoal]);
    vi.mocked(window.api.getTasks).mockResolvedValue([mockTask]);
    vi.mocked(window.api.updateTaskStatus).mockRejectedValue(new Error('IPC Error'));

    render(<GoalsList />);

    // Wait for the task to be rendered
    const [taskButton] = await screen.findAllByRole('button', { name: /Task 1/ });
    if (!taskButton) throw new Error('Task button not found');
    fireEvent.click(taskButton);

    // Check if error message is displayed
    expect(await screen.findByText('Failed to update task status. Please try again.')).toBeTruthy();

    // Verify close button
    const closeBtn = screen.getByLabelText('Close error');
    fireEvent.click(closeBtn);
    expect(screen.queryByText('Failed to update task status. Please try again.')).toBeNull();
  });

  it('displays error message when data fetching fails', async () => {
    vi.mocked(window.api.getGoals).mockRejectedValue(new Error('Fetch Error'));

    render(<GoalsList />);

    expect(await screen.findByText('Failed to load goals and tasks. Please try again.')).toBeTruthy();
  });
});
