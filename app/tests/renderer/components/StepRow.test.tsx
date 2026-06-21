import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { StepRow } from '../../../src/renderer/components/StepRow';

describe('StepRow', () => {
  it('renders all three states', () => {
    const states = ['pending', 'current', 'done'] as const;
    for (const state of states) {
      const { container, unmount } = render(<StepRow label="Test" state={state} index={1} />);
      const step = container.querySelector('[data-state]');
      expect(step).toHaveAttribute('data-state', state);
      unmount();
    }
  });

  it('shows strike-through on done state only', () => {
    const { container: done } = render(<StepRow label="Test" state="done" />);
    const doneLabel = done.querySelector('.plover-step__label');
    expect(doneLabel).toHaveStyle({ textDecoration: 'line-through' });

    const { container: pending } = render(<StepRow label="Test" state="pending" />);
    const pendingLabel = pending.querySelector('.plover-step__label');
    expect(pendingLabel).not.toHaveStyle({ textDecoration: 'line-through' });

    const { container: current } = render(<StepRow label="Test" state="current" />);
    const currentLabel = current.querySelector('.plover-step__label');
    expect(currentLabel).not.toHaveStyle({ textDecoration: 'line-through' });
  });
});
