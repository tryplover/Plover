// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { Expanded } from '../../../src/renderer/companion/Expanded';
import type { CompanionView } from '../../../src/renderer/companion/useCompanionState';

it('ignores progress-pop events while retaining task steps and pause controls', () => {
  const listeners = new Set<(event: unknown) => void>();
  const setState = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(window, 'api', {
    configurable: true,
    value: {
      on: (_channel: string, listener: (event: unknown) => void) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
      companion: { setState },
    },
  });

  const view: CompanionView = {
    kind: 'observing',
    progress: 0.25,
    task: {
      id: 'task-1',
      goal_id: 'goal-1',
      title: 'Draft the intro',
      status: 'in_progress',
      progress: 25,
      estimate_minutes: 25,
      sort_index: 0,
      created_at: '2026-10-07T00:00:00Z',
      updated_at: '2026-10-07T00:00:00Z',
    },
    steps: [{ id: 'step-1', label: 'Write one sentence', done: false, current: true }],
  };
  const props = { view, onCollapse: vi.fn(), progressPopsEnabled: true };
  const { unmount } = render(<Expanded {...props} />);

  act(() => {
    listeners.forEach((listener) =>
      listener({
        type: 'summary.created',
        payload: { task_id: 'task-1', progress_delta: 25 },
      }),
    );
  });

  expect(screen.queryByText('+25%')).toBeNull();
  expect(screen.getByRole('heading', { name: 'Draft the intro' })).toBeTruthy();
  expect(screen.getByText('Write one sentence')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Pause' }));
  expect(setState).toHaveBeenCalledWith('paused');
  unmount();
});
