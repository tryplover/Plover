// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
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
        pauseAllTracking: false,
        windowTrackingEnabled: true,
        gdocsPollingEnabled: true,
        fileWatchingEnabled: true,
        screenCaptureEnabled: false,
        screenCaptureIntervalMinutes: 5,
        screenVisionInferenceEnabled: false,
        activityRetentionDays: 30,
        planner_useRecentActivityContext: true,
      }),
      updateSettings: vi.fn().mockResolvedValue(undefined),
      getScreenRecordingStatus: vi.fn().mockResolvedValue('not-determined'),
      requestScreenRecording: vi.fn().mockResolvedValue('not-determined'),
      openScreenRecordingSettings: vi.fn().mockResolvedValue(undefined),
      purgeActivity: vi.fn().mockResolvedValue({ deleted: 0 }),
      getAuthStatus: vi.fn().mockResolvedValue({
        signedIn: false,
        email: null,
        plan: 'free',
      }),
      signIn: vi.fn().mockResolvedValue({
        signedIn: true,
        email: 'user@example.com',
        plan: 'free',
      }),
      signOut: vi.fn().mockResolvedValue(undefined),
      refreshSubscription: vi.fn().mockResolvedValue({
        signedIn: true,
        email: 'user@example.com',
        plan: 'free',
      }),
      openUpgradePage: vi.fn().mockResolvedValue(undefined),
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
    await act(async () => {
      await Promise.resolve();
    });
  });

  it('renders the Account section heading', async () => {
    render(<Settings />);
    expect(await screen.findByRole('heading', { name: 'Account' })).toBeTruthy();
    await act(async () => {
      await Promise.resolve();
    });
  });

  it('forwards data-testid to root element', async () => {
    render(<Settings data-testid="page-settings" />);
    expect(await screen.findByTestId('page-settings')).toBeTruthy();
    await act(async () => {
      await Promise.resolve();
    });
  });
});
