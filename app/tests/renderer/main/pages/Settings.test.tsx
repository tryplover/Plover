// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import Settings from '../../../../src/renderer/main/pages/Settings';

const mockUnsubscribe = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(window, 'api', {
    value: {
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

describe('Settings', () => {
  it('renders the Settings heading', async () => {
    render(<Settings />);
    expect(await screen.findByRole('heading', { name: 'Settings' })).toBeTruthy();
  });

  it('renders the Account section heading', async () => {
    render(<Settings />);
    expect(await screen.findByRole('heading', { name: 'Account' })).toBeTruthy();
  });

  it('forwards data-testid to root element', async () => {
    render(<Settings data-testid="page-settings" />);
    expect(await screen.findByTestId('page-settings')).toBeTruthy();
  });
});
