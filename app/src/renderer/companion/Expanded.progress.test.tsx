// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { Expanded } from './Expanded';
import type { CompanionView } from './useCompanionState';
import type { Task } from '../../shared/types';

const task: Task = {
  id: 'task-1',
  goal_id: 'goal-1',
  title: 'Write the report',
  estimate_minutes: 30,
  sort_index: 0,
  status: 'in_progress',
  progress: 40,
  created_at: '2026-10-13T00:00:00Z',
  updated_at: '2026-10-13T00:00:00Z',
};

describe('Expanded', () => {
  it('shows no percentage for the task or the goal', () => {
    const view: CompanionView = { kind: 'observing', task, steps: [] };

    const { container } = render(<Expanded view={view} onCollapse={() => undefined} />);

    expect(container.textContent).not.toMatch(/%/);
    expect(container.textContent).toContain('Write the report');
  });
});
