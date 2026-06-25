// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { Activity } from '../../src/renderer/main/pages/Activity.js';

beforeEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(window, 'api', {
    value: {
      listActivity: vi.fn().mockResolvedValue([
        { id: 1, ts: '2026-06-25T12:00:00.000Z', kind: 'window_focus', payload: { app: 'Slack', title: '#eng' } },
      ]),
      purgeActivity: vi.fn().mockResolvedValue({ deleted: 1 }),
      getScreenshot: vi.fn(),
      getActivityById: vi.fn(),
    },
    writable: true,
    configurable: true,
  });
});

describe('Activity page', () => {
  it('renders rows from listActivity', async () => {
    render(<Activity />);
    expect(await screen.findByText(/Slack/)).toBeTruthy();
  });

  it('removes a row when × is clicked', async () => {
    render(<Activity />);
    const del = await screen.findByLabelText('Delete');
    await act(async () => {
      fireEvent.click(del);
    });
    expect(screen.queryByText(/Slack/)).toBeNull();
  });
});
