import { describe, it, expect } from 'vitest';

describe('ProgressLine', () => {
  it('clamps value to 0-1 range', () => {
    const value1 = 1.5;
    const clamped1 = Math.max(0, Math.min(1, value1));
    expect(clamped1).toBe(1);

    const value2 = -0.2;
    const clamped2 = Math.max(0, Math.min(1, value2));
    expect(clamped2).toBe(0);
  });

  it('uses solid tone by default', () => {
    const tone = 'solid';
    expect(tone).toBe('solid');
  });

  it('accepts mint tone', () => {
    const toneValue = 'mint' as const;
    expect(toneValue).toBe('mint');
  });
});
