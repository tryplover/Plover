// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import GoalsList from '../../../../src/renderer/main/pages/GoalsList';

const mockUnsubscribe = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(window, 'api', {
    value: {
      getGoals: vi.fn().mockResolvedValue([]),
      getTasks: vi.fn().mockResolvedValue([]),
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

  it('renders the goal input placeholder', async () => {
    render(<GoalsList />);
    expect(await screen.findByPlaceholderText('What are you working on?')).toBeTruthy();
  });

  it('forwards data-testid to root element', async () => {
    render(<GoalsList data-testid="page-goals" />);
    expect(await screen.findByTestId('page-goals')).toBeTruthy();
  });
});
