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
      getTaskById: vi.fn().mockResolvedValue(null),
      getSettings: vi.fn().mockResolvedValue({
        googleConnected: false,
        workingHours: { start: '09:00', end: '18:00' },
        horizonDays: 14,
        pauseScheduling: false,
        theme: 'light',
      }),
      companion: {
        getInitialState: vi.fn().mockResolvedValue({ kind: 'observing', activeTaskId: null }),
        setActiveTask: vi.fn().mockResolvedValue(undefined),
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

describe('App', () => {
  it('renders the Plover brand name', async () => {
    render(<App />);
    expect(await screen.findByText('Plover')).toBeTruthy();
  });

  it('applies plover-shell--light when theme is light', async () => {
    const { container } = render(<App />);
    expect(await screen.findByText('Plover')).toBeTruthy();
    expect(
      container.querySelector('.app-container')?.classList.contains('plover-shell--light'),
    ).toBe(true);
  });

  it('renders all nav tabs', async () => {
    render(<App />);
    expect(await screen.findByTestId('nav-home')).toBeTruthy();
    expect(screen.getByTestId('nav-progress')).toBeTruthy();
    expect(screen.getByTestId('nav-settings')).toBeTruthy();
    expect(screen.queryByTestId('nav-goals')).toBeNull();
    expect(screen.queryByTestId('nav-today')).toBeNull();
    expect(screen.queryByTestId('nav-activity')).toBeNull();
  });

  it('shows Home page by default', async () => {
    render(<App />);
    expect(await screen.findByTestId('page-home')).toBeTruthy();
  });
});
