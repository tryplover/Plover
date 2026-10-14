// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { SetupFlow } from './SetupFlow.js';

const plan = {
  goal: { title: 'Write essay' },
  subtasks: [{ title: 'Outline', estimate_minutes: 30, depends_on: [] }],
};

describe('SetupFlow flow', () => {
  const proposeGoal = vi.fn();
  const commitGoal = vi.fn();
  const listActiveWindows = vi.fn();
  const closeOverlay = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    proposeGoal.mockResolvedValue(plan);
    commitGoal.mockResolvedValue({ goalId: 'g1' });
    closeOverlay.mockResolvedValue(undefined);
    Object.defineProperty(window, 'api', {
      value: { proposeGoal, commitGoal, listActiveWindows, closeOverlay },
      writable: true,
      configurable: true,
    });
  });

  async function goToBreakdown() {
    fireEvent.change(screen.getByPlaceholderText('Finish the methods section of my thesis'), {
      target: { value: 'Write essay' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Break into steps →' }));
    return screen.findByRole('button', { name: 'Looks right →' });
  }

  it('commits the plan once from the breakdown with no window picker', async () => {
    render(<SetupFlow variant="window" onClose={vi.fn()} />);

    fireEvent.click(await goToBreakdown());

    await waitFor(() => expect(commitGoal).toHaveBeenCalledTimes(1));
    expect(commitGoal).toHaveBeenCalledWith(plan);
    expect(listActiveWindows).not.toHaveBeenCalled();
    expect(screen.queryByText('Which window should I watch?')).not.toBeInTheDocument();
    expect(screen.queryByText('Connect')).not.toBeInTheDocument();
  });

  it('commits only once when Looks right is clicked twice before the commit resolves', async () => {
    render(<SetupFlow variant="window" onClose={vi.fn()} />);

    const looksRight = await goToBreakdown();
    fireEvent.click(looksRight);
    fireEvent.click(looksRight);

    await waitFor(() => expect(commitGoal).toHaveBeenCalled());
    expect(commitGoal).toHaveBeenCalledTimes(1);
  });

  it('stays on the breakdown when the commit fails', async () => {
    const onClose = vi.fn();
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    commitGoal.mockRejectedValueOnce(new Error('offline'));
    render(<SetupFlow variant="window" onClose={onClose} />);

    fireEvent.click(await goToBreakdown());

    await waitFor(() =>
      expect(consoleError).toHaveBeenCalledWith('Failed to commit goal:', expect.any(Error)),
    );
    expect(screen.getByRole('button', { name: 'Looks right →' })).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });
});
