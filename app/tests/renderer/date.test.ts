import { describe, expect, it } from 'vitest';
import { isToday } from '../../src/renderer/lib/date';

describe('isToday', () => {
  const now = new Date('2026-05-30T14:00:00Z');

  it('returns true for a date on the same local calendar day', () => {
    expect(isToday('2026-05-30T09:00:00Z', now)).toBe(true);
  });

  it('returns false for a date on a different day', () => {
    expect(isToday('2026-05-29T23:00:00Z', now)).toBe(false);
  });

  it('returns false for undefined input', () => {
    expect(isToday(undefined, now)).toBe(false);
  });
});
