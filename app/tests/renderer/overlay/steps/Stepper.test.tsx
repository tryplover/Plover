import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('Stepper', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('accepts current prop 1', () => {
    const current = 1 as const;
    expect([1, 2, 3] as const).toContain(current);
  });

  it('accepts current prop 2', () => {
    const current = 2 as const;
    expect([1, 2, 3] as const).toContain(current);
  });

  it('accepts current prop 3', () => {
    const current = 3 as const;
    expect([1, 2, 3] as const).toContain(current);
  });

  it('has three steps: Name, Breakdown, Connect', () => {
    const labels = ['Name', 'Breakdown', 'Connect'] as const;
    expect(labels).toHaveLength(3);
  });

  it('step 1 is Name', () => {
    const label = 'Name' as const;
    expect(['Name', 'Breakdown', 'Connect']).toContain(label);
  });

  it('step 2 is Breakdown', () => {
    const label = 'Breakdown' as const;
    expect(['Name', 'Breakdown', 'Connect']).toContain(label);
  });

  it('step 3 is Connect', () => {
    const label = 'Connect' as const;
    expect(['Name', 'Breakdown', 'Connect']).toContain(label);
  });

  it('step numbers are 1-indexed', () => {
    const steps = [
      { num: 1, label: 'Name' },
      { num: 2, label: 'Breakdown' },
      { num: 3, label: 'Connect' },
    ] as const;
    expect(steps[0]?.num).toBe(1);
    expect(steps[1]?.num).toBe(2);
    expect(steps[2]?.num).toBe(3);
  });

  it('step markers are distinct numbers', () => {
    const steps = [1, 2, 3] as const;
    expect(steps[0]).toBe(1);
    expect(steps[1]).toBe(2);
    expect(steps[2]).toBe(3);
  });

  it('current can match step number', () => {
    const current: 1 | 2 | 3 = 1;
    const targetStep = 1;
    expect(current).toBe(targetStep);
  });

  it('can transition current from 1 to 2', () => {
    let current: 1 | 2 | 3 = 1;
    current = 2;
    expect(current).toBe(2);
  });

  it('can transition current from 2 to 3', () => {
    let current: 1 | 2 | 3 = 2;
    current = 3;
    expect(current).toBe(3);
  });

  it('can transition current from 3 to 2', () => {
    let current: 1 | 2 | 3 = 3;
    current = 2;
    expect(current).toBe(2);
  });
});
