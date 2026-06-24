// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import TasksToday from '../../../../src/renderer/main/pages/TasksToday';

const mockUnsubscribe = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(window, 'api', {
    value: {
      getTasks: vi.fn().mockResolvedValue([]),
      getGoals: vi.fn().mockResolvedValue([]),
      on: vi.fn().mockReturnValue(mockUnsubscribe),
    },
    writable: true,
    configurable: true,
  });
});

describe('TasksToday', () => {
  it('renders the Today heading', async () => {
    render(<TasksToday />);
    expect(await screen.findByRole('heading', { name: 'Today' })).toBeTruthy();
  });

  it('forwards data-testid to root element', async () => {
    render(<TasksToday data-testid="page-today" />);
    expect(await screen.findByTestId('page-today')).toBeTruthy();
  });
});
