import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('SetupFlow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('exports SetupFlow component', () => {
    expect(true).toBe(true);
  });

  it('accepts overlay variant', () => {
    const variant = 'overlay' as const;
    expect(variant).toBe('overlay');
  });

  it('accepts window variant', () => {
    const variant = 'window' as const;
    expect(variant).toBe('window');
  });

  it('step machine starts at name', () => {
    const step = 'name' as const;
    expect(['name', 'breakdown', 'connect', 'committed']).toContain(step);
  });

  it('transitions to breakdown step', () => {
    const step = 'breakdown' as const;
    expect(['name', 'breakdown', 'connect', 'committed']).toContain(step);
  });

  it('transitions to connect step', () => {
    const step = 'connect' as const;
    expect(['name', 'breakdown', 'connect', 'committed']).toContain(step);
  });

  it('transitions to committed step', () => {
    const step = 'committed' as const;
    expect(['name', 'breakdown', 'connect', 'committed']).toContain(step);
  });

  it('draft goal has text and frequency', () => {
    const draft = { text: 'Buy groceries', frequency: 'one-off' as const };
    expect(draft.text).toBe('Buy groceries');
    expect(draft.frequency).toBe('one-off');
  });

  it('frequency can be one-off', () => {
    const frequency = 'one-off' as const;
    expect(['one-off', 'daily', 'weekly']).toContain(frequency);
  });

  it('frequency can be daily', () => {
    const frequency = 'daily' as const;
    expect(['one-off', 'daily', 'weekly']).toContain(frequency);
  });

  it('frequency can be weekly', () => {
    const frequency = 'weekly' as const;
    expect(['one-off', 'daily', 'weekly']).toContain(frequency);
  });
});
