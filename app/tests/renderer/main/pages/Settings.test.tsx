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
      purgeActivity: vi.fn().mockResolvedValue({ deleted: 0 }),
      exportData: vi.fn().mockResolvedValue({ success: true, filePath: '/mock/path' }),
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

  it('renders the Data portability section heading', async () => {
    render(<Settings />);
    expect(await screen.findByRole('heading', { name: 'Data portability' })).toBeTruthy();
  });

  it('renders the Export my data button', async () => {
    render(<Settings />);
    expect(await screen.findByRole('button', { name: 'Export my data' })).toBeTruthy();
  });
});
