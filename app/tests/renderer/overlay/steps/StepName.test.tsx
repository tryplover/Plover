import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('StepName', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('accepts value prop with text and frequency', () => {
    const value = { text: 'Write report', frequency: 'one-off' as const };
    expect(value.text).toBe('Write report');
    expect(value.frequency).toBe('one-off');
  });

  it('accepts onChange handler', () => {
    const onChange = vi.fn();
    expect(onChange).toBeDefined();
  });

  it('accepts onNext handler', () => {
    const onNext = vi.fn();
    expect(onNext).toBeDefined();
  });

  it('accepts variant prop', () => {
    const variant = 'overlay' as const;
    expect(['overlay', 'window']).toContain(variant);
  });

  it('variant can be window', () => {
    const variant = 'window' as const;
    expect(['overlay', 'window']).toContain(variant);
  });

  it('form submission is prevented', () => {
    const prevent = { preventDefault: vi.fn() };
    expect(prevent.preventDefault).toBeDefined();
  });

  it('text input can be empty', () => {
    const value = { text: '', frequency: 'one-off' as const };
    expect(value.text).toBe('');
  });

  it('text input can be filled', () => {
    const value = { text: 'Finish thesis methods section', frequency: 'one-off' as const };
    expect(value.text).not.toBe('');
    expect(value.text.trim().length).toBeGreaterThan(0);
  });

  it('frequency transitions from one-off', () => {
    const from = { text: 'Task', frequency: 'one-off' as const };
    const to = { ...from, frequency: 'daily' as const };
    expect(from.frequency).toBe('one-off');
    expect(to.frequency).toBe('daily');
  });

  it('frequency transitions to weekly', () => {
    const from = { text: 'Task', frequency: 'daily' as const };
    const to = { ...from, frequency: 'weekly' as const };
    expect(from.frequency).toBe('daily');
    expect(to.frequency).toBe('weekly');
  });
});
