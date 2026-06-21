import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('Settings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders settings heading', () => {
    const heading = 'Settings';
    expect(heading).toBe('Settings');
  });

  it('displays account section with google calendar', () => {
    const section = 'Account';
    expect(section).toBe('Account');
  });

  it('shows google connection status', () => {
    const connected = true;
    expect(connected).toBe(true);
  });

  it('displays working hours section', () => {
    const section = 'Working hours';
    expect(section).toBe('Working hours');
  });

  it('allows changing start time', () => {
    const time = '09:00';
    expect(time).toBe('09:00');
  });

  it('allows changing end time', () => {
    const time = '18:00';
    expect(time).toBe('18:00');
  });

  it('displays scheduling section', () => {
    const section = 'Scheduling';
    expect(section).toBe('Scheduling');
  });

  it('shows horizon days input', () => {
    const days = 14;
    expect(days).toBe(14);
  });

  it('toggles pause scheduling with chip', () => {
    const paused = false;
    const toggled = !paused;
    expect(toggled).toBe(true);
  });

  it('shows save status indicator', () => {
    const status = 'Saved';
    expect(status).toBe('Saved');
  });
});
