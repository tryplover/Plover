// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import Settings from './Settings.js';

const mockUnsubscribe = vi.fn();
let mockAuthGetStatus: ReturnType<typeof vi.fn>;
let mockAuthSignIn: ReturnType<typeof vi.fn>;
let mockAuthSignOut: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  mockAuthGetStatus = vi.fn().mockResolvedValue({ signedIn: false, email: null });
  mockAuthSignIn = vi.fn().mockResolvedValue({ signedIn: true, email: 'jordan@example.com' });
  mockAuthSignOut = vi.fn().mockResolvedValue({ signedIn: false, email: null });
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
      auth: {
        getStatus: mockAuthGetStatus,
        signIn: mockAuthSignIn,
        signOut: mockAuthSignOut,
      },
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

  it('renders the Plover Account row reflecting getStatus() and calls signIn on click', async () => {
    render(<Settings />);
    await act(async () => {
      await Promise.resolve();
    });

    expect(mockAuthGetStatus).toHaveBeenCalled();
    const signInButton = await screen.findByRole('button', { name: 'Sign in with Google' });

    await act(async () => {
      fireEvent.click(signInButton);
      await Promise.resolve();
    });

    expect(mockAuthSignIn).toHaveBeenCalledTimes(1);
    expect(await screen.findByText('Signed in as jordan@example.com')).toBeTruthy();
  });

  it('shows the signed-in state and calls signOut when already signed in', async () => {
    mockAuthGetStatus.mockResolvedValue({ signedIn: true, email: 'sam@example.com' });

    render(<Settings />);
    await act(async () => {
      await Promise.resolve();
    });

    expect(await screen.findByText('Signed in as sam@example.com')).toBeTruthy();
    const signOutButton = await screen.findByRole('button', { name: 'Sign out' });

    await act(async () => {
      fireEvent.click(signOutButton);
      await Promise.resolve();
    });

    expect(mockAuthSignOut).toHaveBeenCalledTimes(1);
  });
});
