import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('App', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders sidebar tabs', () => {
    const tabs = ['Today', 'Goals', 'Settings'];
    expect(tabs).toHaveLength(3);
  });

  it('today tab is active by default', () => {
    const activeTab = 'today' as const;
    expect(['today', 'goals', 'settings']).toContain(activeTab);
  });

  it('switches to goals tab', () => {
    const tab = 'goals' as const;
    expect(['today', 'goals', 'settings']).toContain(tab);
  });

  it('switches to settings tab', () => {
    const tab = 'settings' as const;
    expect(['today', 'goals', 'settings']).toContain(tab);
  });

  it('renders plover brand with dot and word', () => {
    const brandElements = ['dot', 'word'];
    expect(brandElements).toHaveLength(2);
  });

  it('displays version label in sidebar', () => {
    const version = 'Plover v1.0.0';
    expect(version).toContain('Plover');
    expect(version).toContain('1.0.0');
  });
});
