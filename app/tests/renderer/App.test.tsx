// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { App } from '../../src/renderer/App';

const mockUnsubscribe = vi.fn();

beforeEach(() => {
  localStorage.setItem('plover_onboarding_completed', 'true');
  vi.clearAllMocks();
  Object.defineProperty(window, 'api', {
    value: {
      getTasks: vi.fn().mockResolvedValue([]),
      getGoals: vi.fn().mockResolvedValue([]),
      getSettings: vi.fn().mockResolvedValue({
        googleConnected: false,
        workingHours: { start: '09:00', end: '18:00' },
        horizonDays: 14,
        pauseScheduling: false,
      }),
      on: vi.fn().mockReturnValue(mockUnsubscribe),
    },
    writable: true,
    configurable: true,
  });
});

describe('App', () => {
  it('renders the Plover brand name', async () => {
    render(<App />);
    expect(await screen.findByText('Plover')).toBeTruthy();
  });

  it('renders all three nav tabs', async () => {
    render(<App />);
    expect(await screen.findByTestId('nav-goals')).toBeTruthy();
    expect(screen.getByTestId('nav-progress')).toBeTruthy();
    expect(screen.getByTestId('nav-settings')).toBeTruthy();
  });

  it('shows Goals page by default', async () => {
    render(<App />);
    expect(await screen.findByTestId('page-goals')).toBeTruthy();
  });
});
