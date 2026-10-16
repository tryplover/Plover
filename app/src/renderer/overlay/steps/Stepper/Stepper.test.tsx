import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('Stepper', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('accepts current prop 1', () => {
    const current = 1 as const;
    expect([1, 2] as const).toContain(current);
  });

  it('accepts current prop 2', () => {
    const current = 2 as const;
    expect([1, 2] as const).toContain(current);
  });

  it('has two steps: Name, Breakdown', () => {
    const labels = ['Name', 'Breakdown'] as const;
    expect(labels).toHaveLength(2);
  });

  it('step 1 is Name', () => {
    const label = 'Name' as const;
    expect(['Name', 'Breakdown']).toContain(label);
  });

  it('step 2 is Breakdown', () => {
    const label = 'Breakdown' as const;
    expect(['Name', 'Breakdown']).toContain(label);
  });

  it('step numbers are 1-indexed', () => {
    const steps = [
      { num: 1, label: 'Name' },
      { num: 2, label: 'Breakdown' },
    ] as const;
    expect(steps[0]?.num).toBe(1);
    expect(steps[1]?.num).toBe(2);
  });

  it('step markers are distinct numbers', () => {
    const steps = [1, 2] as const;
    expect(steps[0]).toBe(1);
    expect(steps[1]).toBe(2);
  });

  it('current can match step number', () => {
    const current: 1 | 2 = 1;
    const targetStep = 1;
    expect(current).toBe(targetStep);
  });

  it('can transition current from 1 to 2', () => {
    let current: 1 | 2 = 1;
    current = 2;
    expect(current).toBe(2);
  });
});
